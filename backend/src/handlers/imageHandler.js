import {
  sendTyping,
  sendThinking,
  sendTelegramMessage,
  editTelegramMessage,
  getFileLink,
  downloadFile
} from "../services/telegramService.js";

import { askRAGWithImage } from "../services/aiService.js";
import { logInfo, logError } from "../utils/logger.js";

export async function handleImage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const caption = message.caption || "";

  logInfo("Image received", {
    userId,
    caption
  });

  try {
    await sendTyping(chatId);

    const photo = message.photo[message.photo.length - 1];
    const filePath = await getFileLink(photo.file_id);
    const base64Data = await downloadFile(filePath);

    const thinkingMessageId = await sendThinking(chatId);

    // Full pipeline: Image Analysis → RAG Retrieval → Gemini Grounding → Response
    const answer = await askRAGWithImage(caption, "image/jpeg", base64Data);

    // Replace thinking indicator with real answer
    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, answer);
    } else {
      await sendTelegramMessage(chatId, answer);
    }

  } catch (error) {
    logError("Image Handler Error", { error: error.message });

    await sendTelegramMessage(
      chatId,
      "Sorry, I couldn't process that image. Please try again."
    );
  }
}