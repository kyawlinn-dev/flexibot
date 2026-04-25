import {
  extractMemory,
  saveMemoryItems,
} from "../services/memoryService.js";
import {
  shouldCreateSummary,
  generateRollingSummary,
  saveSummary,
} from "../services/summaryService.js";
import {
  sendTelegramMessage,
  sendThinking,
  editTelegramMessage,
} from "../services/telegramService.js";
import { askRAG } from "../services/aiService.js";
import { createMessage } from "../services/messageService.js";
import { getOrCreateActiveSession, clearLoginState } from "../services/sessionService.js";
import { handleLoginFlow } from "../services/authService.js";
import { buildAIContext } from "../services/contextBuilder.js";
import { logInfo, logError } from "../utils/logger.js";

function normalizeText(text = "") {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function getDirectReply(text, isLoggedIn = false) {
  const normalized = normalizeText(text);

  if (!normalized) return null;

  if (/^(hi|hello|hey|helo|yo|mingalarpar|mingalar par)$/i.test(normalized)) {
    return isLoggedIn
      ? "👋 Hello! You're connected. Ask me anything about RSU, IT, or student-related help."
      : "👋 Hello! Ask me about RSU, IT, or university information.\n\nYou can use Login for personal features.";
  }

  if (/^(thanks|thank you|thx|ty|thank u)$/i.test(normalized)) {
    return "You're welcome 😊";
  }

  if (/^(bye|goodbye|see ya|see you|gn|good night)$/i.test(normalized)) {
    return "Good luck with your work 👋";
  }

  if (/^(who are you|what are you|what can you do|what do you do)$/i.test(normalized)) {
    return (
      "🤖 I'm the RSU AI Assistant.\n\n" +
      "I can help with:\n" +
      "• University information\n" +
      "• IT support guidance\n" +
      "• Campus-related questions\n" +
      "• Personal student features after login"
    );
  }

  return null;
}

export async function handleText(message) {
  const chatId = String(message.chat.id);
  const text = (message.text || "").trim();
  const userId = String(message.from.id);

  logInfo("Text message received", { userId, text });

  const totalStart = Date.now();

  try {
    if (!text) {
      await sendTelegramMessage(chatId, "Please send a message.");
      return;
    }

    // ✅ 1. Quick replies
    const quickReply = getDirectReply(text);
    if (quickReply) {
      await sendTelegramMessage(chatId, quickReply);
      return;
    }

    // ✅ 2. Session
    const session = await getOrCreateActiveSession(userId, chatId);

    // ✅ 3. FIXED LOGIN FLOW (INTERRUPTIBLE)
    if (session.login_state) {
      const isLikelyLoginInput =
        /^[0-9]+$/.test(text) || text.length < 30;

      if (!isLikelyLoginInput) {
        // 🚀 Exit login automatically
        await clearLoginState(userId);

        await sendTelegramMessage(
          chatId,
          "ℹ️ Login cancelled. You can continue asking questions 😊"
        );
      } else {
        const loginResult = await handleLoginFlow({
          session,
          telegramUserId: userId,
          telegramChatId: chatId,
          text,
        });

        if (loginResult.handled) {
          await sendTelegramMessage(chatId, loginResult.reply);

          // If login succeeded, show the main menu right away
          if (loginResult.student) {
            const { formatMainMenu, MAIN_MENU_KEYBOARD } = await import("../formatters/cardFormatter.js");
            await sendTelegramMessage(chatId, formatMainMenu(loginResult.student), {
              reply_markup: MAIN_MENU_KEYBOARD,
            });
          }

          return;
        }
      }
    }

    // ✅ 4. Check protected queries
    const isLoggedIn = Boolean(session.linked_student_id);

    if (/schedule|my data|profile|my account/i.test(text)) {
      if (!isLoggedIn) {
        await sendTelegramMessage(
          chatId,
          "🔐 Please login to access your personal data.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔐 Login", callback_data: "login" }]
              ]
            }
          }
        );
        return;
      }
    }

    // ✅ 5. Show thinking
    const thinkingMessageId = await sendThinking(chatId);

    // ✅ 6. Build context
    const context = await buildAIContext({
      sessionId: session.id,
      telegramUserId: userId,
    });

    // ✅ 7. Save user message
    const userMessageRow = await createMessage({
      sessionId: session.id,
      role: "user",
      content: text,
      metadata: { source: "telegram", path: "rag" },
    });

    // ✅ 8. Ask AI
    const answer = await askRAG(
      text,
      context.studentContext,
      context.history,
      context.conversationSummary,
      context.memoryItems
    );

    // ✅ 9. Save AI reply
    await createMessage({
      sessionId: session.id,
      role: "model",
      content: answer,
      metadata: { source: "gemini", path: "rag" },
    });

    // ✅ 10. Send response
    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, answer);
    } else {
      await sendTelegramMessage(chatId, answer);
    }

    // ✅ 11. Background memory + summary
    const memories = await extractMemory({
      userText: text,
      assistantText: answer,
    });

    if (memories.length) {
      await saveMemoryItems({
        telegramUserId: userId,
        sessionId: session.id,
        sourceMessageId: userMessageRow?.id || null,
        memories,
      });
    }

    const shouldSummarizeNow = await shouldCreateSummary(session.id);

    if (shouldSummarizeNow) {
      const summaryResult = await generateRollingSummary(session.id);

      if (summaryResult) {
        await saveSummary({
          sessionId: session.id,
          summaryText: summaryResult.summaryText,
          coveredUntilMessageId: summaryResult.coveredUntilMessageId,
        });
      }
    }

  } catch (error) {
    logError("Text Handler Error", {
      error: error.message,
      stack: error.stack,
    });

    await sendTelegramMessage(
      chatId,
      "Sorry, something went wrong. Please try again."
    );
  }
}