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

  const totalStart = Date.now();

  try {
    let stepStart = Date.now();
    await sendTyping(chatId);
    console.log("Timing: sendTyping =", Date.now() - stepStart, "ms");

    stepStart = Date.now();
    const session = await getOrCreateActiveSession(userId, chatId);
    console.log(
      "Timing: getOrCreateActiveSession =",
      Date.now() - stepStart,
      "ms"
    );

    stepStart = Date.now();
    if (session.login_state) {
      const loginResult = await handleLoginFlow({
        session,
        telegramUserId: userId,
        telegramChatId: chatId,
        text,
      });

      console.log("Timing: handleLoginFlow =", Date.now() - stepStart, "ms");

      if (loginResult.handled) {
        const replyStart = Date.now();
        await sendTelegramMessage(chatId, loginResult.reply);
        console.log(
          "Timing: sendTelegramMessage(login reply) =",
          Date.now() - replyStart,
          "ms"
        );

        console.log(
          "Timing: total handleText =",
          Date.now() - totalStart,
          "ms"
        );
        return;
      }
    }

    stepStart = Date.now();
    const thinkingMessageId = await sendThinking(chatId);
    console.log("Timing: sendThinking =", Date.now() - stepStart, "ms");

    stepStart = Date.now();
    const context = await buildAIContext({
      sessionId: session.id,
      telegramUserId: userId,
    });
    console.log("Timing: buildAIContext =", Date.now() - stepStart, "ms");

    stepStart = Date.now();
    const userMessageRow = await createMessage({
      sessionId: session.id,
      telegramUserId: userId,
      role: "user",
      content: text,
      metadata: { source: "telegram" },
    });
    console.log("Timing: createMessage(user) =", Date.now() - stepStart, "ms");

    stepStart = Date.now();
    const answer = await askRAG(
      text,
      context.studentContext,
      context.history,
      context.conversationSummary,
      context.memoryItems
    );
    console.log("Timing: askRAG =", Date.now() - stepStart, "ms");

    stepStart = Date.now();
    await createMessage({
      sessionId: session.id,
      telegramUserId: userId,
      role: "model",
      content: answer,
      metadata: { source: "gemini" },
    });
    console.log("Timing: createMessage(model) =", Date.now() - stepStart, "ms");

    stepStart = Date.now();
    const memories = await extractMemory({
      userText: text,
      assistantText: answer,
    });
    console.log(
      "Timing: extractMemory =",
      Date.now() - stepStart,
      "ms",
      "| memoryCount =",
      memories.length
    );

    if (memories.length) {
      stepStart = Date.now();
      await saveMemoryItems({
        telegramUserId: userId,
        sessionId: session.id,
        sourceMessageId: userMessageRow?.id || null,
        memories,
      });
      console.log("Timing: saveMemoryItems =", Date.now() - stepStart, "ms");
    }

    stepStart = Date.now();
    const shouldSummarizeNow = await shouldCreateSummary(session.id);
    console.log(
      "Timing: shouldCreateSummary =",
      Date.now() - stepStart,
      "ms",
      "| shouldSummarizeNow =",
      shouldSummarizeNow
    );

    if (shouldSummarizeNow) {
      stepStart = Date.now();
      const summaryResult = await generateRollingSummary(session.id);
      console.log(
        "Timing: generateRollingSummary =",
        Date.now() - stepStart,
        "ms",
        "| hasSummary =",
        Boolean(summaryResult)
      );

      if (summaryResult) {
        stepStart = Date.now();
        await saveSummary({
          sessionId: session.id,
          telegramUserId: userId,
          summaryText: summaryResult.summaryText,
          coveredUntilMessageId: summaryResult.coveredUntilMessageId,
          summaryType: "rolling",
        });
        console.log("Timing: saveSummary =", Date.now() - stepStart, "ms");
      }
    }

    stepStart = Date.now();
    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, answer);
      console.log("Timing: editTelegramMessage =", Date.now() - stepStart, "ms");
    } else {
      await sendTelegramMessage(chatId, answer);
      console.log(
        "Timing: sendTelegramMessage(final) =",
        Date.now() - stepStart,
        "ms"
      );
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