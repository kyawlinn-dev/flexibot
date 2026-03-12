import { sendTelegramMessage } from "../services/telegramService.js";

export async function handleCommand(message) {

  const chatId = message.chat.id;
  const command = message.text;

  if (command === "/start") {

    await sendTelegramMessage(
      chatId,
      "👋 Welcome to RSU AI Assistant!\n\nI'm here to help RSU students with university and IT questions. Just ask me anything!"
    );

  } else if (command === "/help") {

    await sendTelegramMessage(
      chatId,
      "🤖 <b>RSU AI Assistant — Help</b>\n\n" +
      "I can help you with:\n" +
      "• University policies &amp; procedures\n" +
      "• IT &amp; technology questions\n" +
      "• Campus services &amp; schedules\n" +
      "• General academic guidance\n\n" +
      "Just send me a message or a photo and I'll do my best to help!"
    );

  } else {

    await sendTelegramMessage(
      chatId,
      "Unknown command. Type /help to see what I can do."
    );

  }

}