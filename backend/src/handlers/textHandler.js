import { sendTyping, sendThinking, sendTelegramMessage, editTelegramMessage } from "../services/telegramService.js";
import { askRAG } from "../services/aiService.js";
import { getHistory, pushToHistory } from "../services/conversationStore.js";
import { logInfo, logError } from "../utils/logger.js";

export async function handleText(message) {
  const chatId = message.chat.id;
  const text = message.text;
  const userId = message.from.id;

  logInfo("Text message received", { userId, text });

  try {
    await sendTyping(chatId);

    const thinkingMessageId = await sendThinking(chatId);

    const history = await getHistory(userId);
    const answer = await askRAG(text, null, history);

    await pushToHistory(userId, "user", text);
    await pushToHistory(userId, "model", answer);

    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, answer);
    } else {
      await sendTelegramMessage(chatId, answer);
    }

  } catch (error) {
    logError("Text Handler Error", { error: error.message });

    await sendTelegramMessage(
      chatId,
      "Sorry, something went wrong. Please try again."
    );
  }
}