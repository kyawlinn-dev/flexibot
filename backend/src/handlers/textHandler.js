import {
  sendTyping,
  sendThinking,
  sendTelegramMessage,
  editTelegramMessage,
} from "../services/telegramService.js";
import { askRAG } from "../services/aiService.js";
import { getHistory, pushToHistory } from "../services/conversationStore.js";
import { getOrCreateActiveSession } from "../services/sessionService.js";
import { handleLoginFlow } from "../services/authService.js";
import { logInfo, logError } from "../utils/logger.js";

export async function handleText(message) {
  const chatId = String(message.chat.id);
  const text = message.text;
  const userId = String(message.from.id);

  logInfo("Text message received", { userId, text });

  try {
    await sendTyping(chatId);

    const session = await getOrCreateActiveSession(userId, chatId);

    // Handle ongoing login flow before normal RAG
    if (session.login_state) {
      const loginResult = await handleLoginFlow({
        session,
        telegramUserId: userId,
        telegramChatId: chatId,
        text,
      });

      if (loginResult.handled) {
        await sendTelegramMessage(chatId, loginResult.reply);
        return;
      }
    }

    const thinkingMessageId = await sendThinking(chatId);

    const history = await getHistory(userId);
    const answer = await askRAG(text, null, history);

    await pushToHistory(userId, "user", text);
    await pushToHistory(userId, "model", answer);

    if (thinkingMessageId) {
      await editTelegramMessage(chatId, thinkingMessageId, answer);
    } else {
      await sendTelegramMessage(chatId, answer);
    }
  } catch (error) {
    logError("Text Handler Error", { error: error.message });

    await sendTelegramMessage(
      chatId,
      "Sorry, something went wrong. Please try again."
    );
  }
}