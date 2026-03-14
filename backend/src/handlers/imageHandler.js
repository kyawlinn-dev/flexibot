import {
  sendTyping,
  sendThinking,
  sendTelegramMessage,
  editTelegramMessage,
  getFileLink,
  downloadFile
} from "../services/telegramService.js";

import { askRAGWithImage } from "../services/aiService.js";
import { getHistory, pushToHistory } from "../services/conversationStore.js";
import { logInfo, logError } from "../utils/logger.js";

function getMimeType(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const mimeTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    heic: "image/heic",
  };
  return mimeTypes[ext] || "image/jpeg";
}

export async function handleImage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const caption = message.caption || "";

  logInfo("Image received", { userId, caption });

  try {
    await sendTyping(chatId);

    const photo = message.photo[message.photo.length - 1];
    const filePath = await getFileLink(photo.file_id);
    const base64Data = await downloadFile(filePath);

    const mimeType = getMimeType(filePath);
    logInfo("Image MIME type detected", { filePath, mimeType });

    const thinkingMessageId = await sendThinking(chatId);

    const history = await getHistory(userId);
    const answer = await askRAGWithImage(caption, mimeType, base64Data, history);

    const historyEntry = caption
      ? `[User sent an image with caption: "${caption}"]`
      : "[User sent an image]";
    await pushToHistory(userId, "user", historyEntry);
    await pushToHistory(userId, "model", answer);

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