import {
  sendTyping,
  sendThinking,
  sendTelegramMessage,
  getFileLink,
  downloadFile
} from "../services/telegramService.js";

import {
  askAIWithImage,
  askRAG
} from "../services/aiService.js";

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

    const photo = message.photo.pop();
    const filePath = await getFileLink(photo.file_id);
    const base64Data = await downloadFile(filePath);

    // STEP 1: Analyze image
    const imageDescription = await askAIWithImage(
      "Describe this image clearly.",
      "image/jpeg",
      base64Data
    );

    logInfo("Image description generated", {
      imageDescription
    });

    // STEP 2: Build RAG query
    const ragQuery = caption
      ? `
Image description:
${imageDescription}

Student question:
${caption}
`
      : `
Image description:
${imageDescription}

What relevant university information can you provide?
`;

    await sendThinking(chatId);

    // STEP 3: Ask RAG
    const answer = await askRAG(ragQuery);
    await sendTelegramMessage(chatId, answer);

  } catch (error) {
    logError("Image Handler Error", {
      error: error.message
    });

    await sendTelegramMessage(
      chatId,
      "Sorry, I couldn't process that image."
    );
  }
}