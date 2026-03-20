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
import { handleLoginFlow } from "../services/authService.js";
import { buildAIContext } from "../services/contextBuilder.js";
import { logInfo, logError } from "../utils/logger.js";

export async function handleText(message) {
  const chatId = String(message.chat.id);
  const text = message.text;
  const userId = String(message.from.id);

  logInfo("Text message received", { userId, text });

  try {
    await sendTyping(chatId);

    const session = await getOrCreateActiveSession(userId, chatId);

    // Handle login flow before normal AI flow
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

    const thinkingMessageId = await sendThinking(chatId);

    // Build AI context before saving current turn
    const context = await buildAIContext({
      sessionId: session.id,
      telegramUserId: userId,
    });

    // Save user message
    const userMessageRow = await createMessage({
      sessionId: session.id,
      telegramUserId: userId,
      role: "user",
      content: text,
      metadata: { source: "telegram" },
    });

    // Ask AI
    const answer = await askRAG(
      text,
      context.studentContext,
      context.history,
      context.conversationSummary,
      context.memoryItems
    );

    // Save assistant reply
    await createMessage({
      sessionId: session.id,
      telegramUserId: userId,
      role: "model",
      content: answer,
      metadata: { source: "gemini" },
    });

    // Extract durable memory
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

    // Maybe generate a rolling summary
    const shouldSummarizeNow = await shouldCreateSummary(session.id);

    if (shouldSummarizeNow) {
      const summaryResult = await generateRollingSummary(session.id);

      if (summaryResult) {
        await saveSummary({
          sessionId: session.id,
          telegramUserId: userId,
          summaryText: summaryResult.summaryText,
          coveredUntilMessageId: summaryResult.coveredUntilMessageId,
          summaryType: "rolling",
        });
      }
    }

    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, answer);
    } else {
      await sendTelegramMessage(chatId, answer);
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