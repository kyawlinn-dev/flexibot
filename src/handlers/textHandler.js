import {
  sendTyping,
  sendThinking,
  editTelegramMessage,
  sendTelegramMessage
} from "../services/telegramService.js";

import { askRAG } from "../services/aiService.js";
import { logInfo, logError } from "../utils/logger.js";

export async function handleText(message) {

  const chatId = message.chat.id;
  const text = message.text;
  const userId = message.from.id;

  logInfo("Text message received", {
    userId,
    text
  });

  console.log("User text:", text);

  try {

    /* show typing indicator */
    await sendTyping(chatId);

    /* send thinking placeholder */
    const thinkingMessageId = await sendThinking(chatId);

    /* ask RAG Engine */
    const aiResponse = await askRAG(text);

    /* if thinking message exists → edit it */
    if (thinkingMessageId) {
      await editTelegramMessage(
        chatId,
        thinkingMessageId,
        aiResponse
      );
    } 
    /* fallback: send normal message */
    else {
      await sendTelegramMessage(
        chatId,
        aiResponse
      );
    }

  } catch (error) {
    logError("Text handler error", { 
      error: error.response?.data || error.message,
      chatId,
      userId
    });
  }
}