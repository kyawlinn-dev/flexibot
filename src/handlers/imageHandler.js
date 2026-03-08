import { 
  sendTelegramMessage,
  sendTyping,
  sendThinking,
  editTelegramMessage,
  getFileLink,
  downloadFile
} from "../services/telegramService.js";
import { logInfo } from "../utils/logger.js";
import { askAIWithImage, askRAG } from "../services/aiService.js";

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
    
    // Step 1: Analyze the image and extract text/meaning
    const prompt = caption 
      ? `Please analyze this image and extract any text, context, or subjects related to: "${caption}"` 
      : "Please analyze this image, extract any text, and describe its contents in detail.";
    const imageDescription = await askAIWithImage(prompt, mimeType, base64Data);

    // Step 2: Query the RAG engine using the image description
    const ragQuery = caption 
      ? `Based on this image described as: "${imageDescription}", please answer the user's question: "${caption}"` 
      : `Based on this image described as: "${imageDescription}", what relevant information can you provide from the university corpus?`;
      
    const ragResponse = await askRAG(ragQuery);

    // Edit or send response
    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, ragResponse);
    } else {
      await sendTelegramMessage(chatId, ragResponse);
    }

  } catch (error) {
    console.error("Image handler error:", error.message);
    await sendTelegramMessage(chatId, "Sorry, I encountered an error while processing the image.");
  }
}