import { 
  sendTelegramMessage,
  sendTyping,
  sendThinking,
  editTelegramMessage,
  getFileLink,
  downloadFile
} from "../services/telegramService.js";
import { logInfo } from "../utils/logger.js";
import { askAIWithImage } from "../services/aiService.js";

export async function handleImage(message) {
  const chatId = message.chat.id;
  const caption = message.caption;
  const photo = message.photo;
  const fileId = photo[photo.length - 1].file_id;

  console.log("Image received:", fileId);
  logInfo("Image received", { fileId, caption });

  try {
    await sendTyping(chatId);
    
    // Send thinking placeholder
    const thinkingMessageId = await sendThinking(chatId);

    // Get image from Telegram
    const filePath = await getFileLink(fileId);
    const base64Data = await downloadFile(filePath);
    
    // Determine mime type
    const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    // Ask AI
    const prompt = caption || "Please describe this image in detail.";
    const aiResponse = await askAIWithImage(prompt, mimeType, base64Data);

    // Edit or send response
    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, aiResponse);
    } else {
      await sendTelegramMessage(chatId, aiResponse);
    }

  } catch (error) {
    console.error("Image handler error:", error.message);
    await sendTelegramMessage(chatId, "Sorry, I encountered an error while processing the image.");
  }
}