import { sendTelegramMessage,sendTyping } from "../services/telegramService.js";
import { logInfo } from "../utils/logger.js";

export async function handleImage(message) {

  const chatId = message.chat.id;

  const caption = message.caption;

  const photo = message.photo;

  const fileId = photo[photo.length - 1].file_id;

  console.log("Image received:", fileId);

  logInfo("Image received", {
    fileId,
    caption
  });

  await sendTyping(chatId);

  if (caption) {

    console.log("Caption:", caption);

    await sendTelegramMessage(
      chatId,
      `Nice image! Caption: ${caption}`
    );

  }

  else {

    await sendTelegramMessage(
      chatId,
      "Nice photo! 📷"
    );

  }

}