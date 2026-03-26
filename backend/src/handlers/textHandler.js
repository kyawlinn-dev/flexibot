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
  sendThinkingAnimated,
  editTelegramMessage,
} from "../services/telegramService.js";
import { askRAG } from "../services/aiService.js";
import { createMessage } from "../services/messageService.js";
import { getOrCreateActiveSession } from "../services/sessionService.js";
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
      "🤖 I'm the RSU AI Assistant.\n\n" +
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

    // ── Pass 1: zero-cost direct replies (no Redis, no Supabase) ───────
    const quickReply = getDirectReply(text);
    if (quickReply) {
      await sendTelegramMessage(chatId, quickReply);
      logInfo("Timing: total handleText", { ms: Date.now() - totalStart, path: "quick_reply" });
      return;
    }

    // ── Load session from Redis ─────────────────────────────────────────
    let t = Date.now();
    const session = await getOrCreateActiveSession(userId, chatId);
    logInfo("Timing: getOrCreateActiveSession", { ms: Date.now() - t });

    // ── Login flow ──────────────────────────────────────────────────────
    if (session.login_state) {
      const loginResult = await handleLoginFlow({
        session,
        telegramUserId: userId,
        telegramChatId: chatId,
        text,
      });

      if (loginResult.handled) {
        await sendTelegramMessage(chatId, loginResult.reply);
        logInfo("Timing: total handleText", { ms: Date.now() - totalStart, path: "login_flow" });
        return;
      }
    }

    // ── Pass 2: login-aware direct replies (session already loaded) ─────
    // Fix 5: read linked_student_id from Redis session — no Supabase call.
    const isLoggedIn = Boolean(session.linked_student_id);
    const sessionReply = getDirectReply(text, isLoggedIn);

    if (sessionReply) {
      await createMessage({ sessionId: session.id, role: "user", content: text, metadata: { source: "telegram", path: "direct_reply" } });
      await createMessage({ sessionId: session.id, role: "model", content: sessionReply, metadata: { source: "direct_reply" } });
      await sendTelegramMessage(chatId, sessionReply);
      logInfo("Timing: total handleText", { ms: Date.now() - totalStart, path: "session_direct_reply" });
      return;
    }

    // ── RAG path ────────────────────────────────────────────────────────
    // Send animated "Thinking." immediately — user sees feedback at once.
    // Typing indicator fires alongside and refreshes automatically.
    t = Date.now();
    const { messageId: thinkingMessageId, stop: stopAnimation } =
      await sendThinkingAnimated(chatId);
    logInfo("Timing: sendThinkingAnimated", { ms: Date.now() - t });

    t = Date.now();
    const context = await buildAIContext({ sessionId: session.id, telegramUserId: userId });
    logInfo("Timing: buildAIContext", { ms: Date.now() - t });

    t = Date.now();
    const userMessageRow = await createMessage({
      sessionId: session.id,
      role: "user",
      content: text,
      metadata: { source: "telegram", path: "rag" },
    });
    logInfo("Timing: createMessage(user)", { ms: Date.now() - t });

    t = Date.now();
    const answer = await askRAG(
      text,
      context.studentContext,
      context.history,
      context.conversationSummary,
      context.memoryItems
    );
    logInfo("Timing: askRAG", { ms: Date.now() - t });

    t = Date.now();
    await createMessage({
      sessionId: session.id,
      role: "model",
      content: answer,
      metadata: { source: "gemini", path: "rag" },
    });
    logInfo("Timing: createMessage(model)", { ms: Date.now() - t });

    // ── Reply to user immediately ───────────────────────────────────────
    // Stop the animation and replace "Thinking." with the actual answer.
    // Memory extraction and summary run AFTER this — user does not wait.
    stopAnimation();
    t = Date.now();
    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, answer);
    } else {
      await sendTelegramMessage(chatId, answer);
    }
    logInfo("Timing: editTelegramMessage", { ms: Date.now() - t });
    logInfo("Timing: total handleText (reply sent)", { ms: Date.now() - totalStart });

    // ── Memory extraction ───────────────────────────────────────────────
    t = Date.now();
    const memories = await extractMemory({ userText: text, assistantText: answer });
    logInfo("Timing: extractMemory", { ms: Date.now() - t, memoryCount: memories.length });

    if (memories.length) {
      t = Date.now();
      await saveMemoryItems({
        telegramUserId: userId,
        sessionId: session.id,
        sourceMessageId: userMessageRow?.id || null,
        memories,
      });
      logInfo("Timing: saveMemoryItems", { ms: Date.now() - t });
    }

    // ── Rolling summary ─────────────────────────────────────────────────
    t = Date.now();
    const shouldSummarizeNow = await shouldCreateSummary(session.id);
    logInfo("Timing: shouldCreateSummary", { ms: Date.now() - t, shouldSummarizeNow });

    if (shouldSummarizeNow) {
      t = Date.now();
      const summaryResult = await generateRollingSummary(session.id);
      logInfo("Timing: generateRollingSummary", { ms: Date.now() - t, hasSummary: !!summaryResult });

      if (summaryResult) {
        t = Date.now();
        await saveSummary({
          sessionId: session.id,
          summaryText: summaryResult.summaryText,
          coveredUntilMessageId: summaryResult.coveredUntilMessageId,
        });
        logInfo("Timing: saveSummary", { ms: Date.now() - t });
      }
    }

    logInfo("Timing: total handleText (all done)", { ms: Date.now() - totalStart });

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