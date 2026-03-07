import { sendTelegramMessage } from "../services/telegramService.js";

export async function handleCommand(message) {

  const chatId = message.chat.id;
  const command = message.text;

  if (command === "/start") {

    await sendTelegramMessage(
      chatId,
      "👋 Welcome to RSU AI Assistant!"
    );

  }

  else if (command === "/help") {

    await sendTelegramMessage(
      chatId,
      "Ask me anything about the university."
    );

  }

  else {

    await sendTelegramMessage(
      chatId,
      "Unknown command."
    );

  }

}