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
  sendTyping,
  sendThinking,
  sendTelegramMessage,
  editTelegramMessage,
} from "../services/telegramService.js";
import { askRAG } from "../services/aiService.js";
import { createMessage } from "../services/messageService.js";
import { getOrCreateActiveSession } from "../services/sessionService.js";
import {
  handleLoginFlow,
  getLinkedStudentByTelegramUserId,
} from "../services/authService.js";
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
      : "👋 Hello! Ask me about RSU, IT, or university information.\n\nUse /login if you want protected student actions.";
  }

  if (/^(thanks|thank you|thx|ty|thank u)$/i.test(normalized)) {
    return "You're welcome 😊";
  }

  if (/^(bye|goodbye|see ya|see you|gn|good night)$/i.test(normalized)) {
    return "Good luck with your work 👋";
  }

  if (/^(who are you|what are you|what can you do|what do you do)$/i.test(normalized)) {
    return (
      "🤖 I’m the RSU AI Assistant.\n\n" +
      "I can help with:\n" +
      "• University information\n" +
      "• IT support guidance\n" +
      "• Campus-related questions\n" +
      "• Protected student features after /login"
    );
  }

  if (/^(how to login|login|log in|how can i login|how do i login)$/i.test(normalized)) {
    return isLoggedIn
      ? "You are already logged in. Use /me to see your linked account, or /logout to unlink it."
      : "To link your student account, type /login";
  }

  if (/^(help|menu|commands)$/i.test(normalized)) {
    return (
      "🤖 RSU AI Assistant\n\n" +
      "Commands:\n" +
      "• /start\n" +
      "• /help\n" +
      "• /login\n" +
      "• /logout\n" +
      "• /me\n" +
      "• /cancel"
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

    const directReply = getDirectReply(text);
    if (directReply) {
      await sendTelegramMessage(chatId, directReply);
      return;
    }

    await sendTyping(chatId);

    const session = await getOrCreateActiveSession(userId, chatId);

    if (session.login_state) {
      const loginResult = await handleLoginFlow({
        session,
        telegramUserId: userId,
        telegramChatId: chatId,
        text,
      });

      if (loginResult.handled) {
        await sendTelegramMessage(chatId, loginResult.reply);
        return;
      }
    }

    const linked = await getLinkedStudentByTelegramUserId(userId).catch(() => null);
    const secondDirectReply = getDirectReply(text, Boolean(linked));

    if (secondDirectReply) {
      await createMessage({
        sessionId: session.id,
        role: "user",
        content: text,
        metadata: { source: "telegram", path: "direct_reply" },
      });

      await createMessage({
        sessionId: session.id,
        role: "model",
        content: secondDirectReply,
        metadata: { source: "direct_reply" },
      });

      await sendTelegramMessage(chatId, secondDirectReply);
      return;
    }

    const thinkingMessageId = await sendThinking(chatId);

    const context = await buildAIContext({
      sessionId: session.id,
      telegramUserId: userId,
    });

    const userMessageRow = await createMessage({
      sessionId: session.id,
      role: "user",
      content: text,
      metadata: { source: "telegram", path: "rag" },
    });

    const answer = await askRAG(
      text,
      context.studentContext,
      context.history,
      context.conversationSummary,
      context.memoryItems
    );

    await createMessage({
      sessionId: session.id,
      role: "model",
      content: answer,
      metadata: { source: "gemini", path: "rag" },
    });

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

    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, answer);
    } else {
      await sendTelegramMessage(chatId, answer);
    }

    console.log("Timing: total handleText =", Date.now() - totalStart, "ms");
  } catch (error) {
    logError("Text Handler Error", {
      error: error.message,
      stack: error.stack,
      totalMs: Date.now() - totalStart,
    });

    await sendTelegramMessage(
      chatId,
      "Sorry, something went wrong. Please try again."
    );
  }
}