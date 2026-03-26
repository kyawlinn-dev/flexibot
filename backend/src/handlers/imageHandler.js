import {
  sendTelegramMessage,
  sendThinking,
  editTelegramMessage,
  getFileLink,
  downloadFile,
} from "../services/telegramService.js";
import { askRAGWithImage } from "../services/aiService.js";
import { getOrCreateActiveSession } from "../services/sessionService.js";
import { createMessage, getRecentMessages } from "../services/messageService.js";
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
  const chatId = String(message.chat.id);
  const userId = String(message.from.id);
  const caption = (message.caption || "").trim();

  logInfo("Image received", { userId, caption });

  const totalStart = Date.now();

  try {
    let t = Date.now();
    const session = await getOrCreateActiveSession(userId, chatId);
    logInfo("Timing: getOrCreateActiveSession", { ms: Date.now() - t });

    const photo = message.photo?.[message.photo.length - 1];
    if (!photo?.file_id) {
      await sendTelegramMessage(
        chatId,
        "I couldn't read that image. Please try again."
      );
      return;
    }

    // Heavy flow starts here → show Thinking...
    t = Date.now();
    const thinkingMessageId = await sendThinking(chatId);
    logInfo("Timing: sendThinking", { ms: Date.now() - t });

    t = Date.now();
    const filePath = await getFileLink(photo.file_id);
    const base64Data = await downloadFile(filePath);
    const mimeType = getMimeType(filePath);
    logInfo("Timing: downloadImage", { ms: Date.now() - t, mimeType });

    const history = await getRecentMessages(session.id, 6);

    t = Date.now();
    const answer = await askRAGWithImage(caption, mimeType, base64Data, history);
    logInfo("Timing: askRAGWithImage", { ms: Date.now() - t });

    const userImageText = caption
      ? `[User sent an image with caption: "${caption}"]`
      : "[User sent an image]";

    await createMessage({
      sessionId: session.id,
      role: "user",
      content: userImageText,
      metadata: {
        source: "telegram",
        type: "image",
        caption,
        file_path: filePath,
      },
    });

    await createMessage({
      sessionId: session.id,
      role: "model",
      content: answer,
      metadata: { source: "gemini", path: "image_rag" },
    });

    t = Date.now();
    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, answer);
    } else {
      await sendTelegramMessage(chatId, answer);
    }
    logInfo("Timing: editTelegramMessage", { ms: Date.now() - t });
    logInfo("Timing: total handleImage (reply sent)", {
      ms: Date.now() - totalStart,
    });
  } catch (error) {
    logError("Image Handler Error", {
      error: error.message,
      stack: error.stack,
      totalMs: Date.now() - totalStart,
    });

    await sendTelegramMessage(
      chatId,
      "Sorry, I couldn't process that image. Please try again."
    );
  }
}