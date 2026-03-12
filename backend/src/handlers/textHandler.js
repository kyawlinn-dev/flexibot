import { sendTyping, sendThinking, sendTelegramMessage, editTelegramMessage } from "../services/telegramService.js";
import { askRAG } from "../services/aiService.js";
import { logInfo, logError } from "../utils/logger.js";

export async function handleText(message) {
  const chatId = message.chat.id;
  const text = message.text;
  const userId = message.from.id;

  logInfo("Text message received", { userId, text });

  try {
    console.log("User text:", text);

    await sendTyping(chatId);
    
    // Show thinking indicator
    const thinkingMessageId = await sendThinking(chatId);

    const answer = await askRAG(text);
    
    // Replace thinking indicator with real answer
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