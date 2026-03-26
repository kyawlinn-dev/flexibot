import { sendTelegramMessage } from "../services/telegramService.js";
import {
  getOrCreateActiveSession,
  clearLoginState,
  updateSession,
} from "../services/sessionService.js";
import {
  getLinkedStudentByTelegramUserId,
  startLoginFlow,
  unlinkTelegramAccount,
} from "../services/authService.js";

function normalizeCommand(rawText = "") {
  const firstToken = rawText.trim().split(/\s+/)[0] || "";
  return firstToken.toLowerCase().replace(/@.+$/, "");
}

export async function handleCommand(message) {
  const chatId = String(message.chat.id);
  const userId = String(message.from.id);
  const rawText = message.text || "";
  const command = normalizeCommand(rawText);

  try {
    if (command === "/start") {
      await sendTelegramMessage(
        chatId,
        "👋 Welcome to RSU AI Assistant!\n\n" +
          "I’m here to help with RSU, university, and IT questions.\n\n" +
          "Use /login to link your student account for protected actions."
      );
      return;
    }

    if (command === "/help") {
      await sendTelegramMessage(
        chatId,
        "🤖 <b>RSU AI Assistant — Help</b>\n\n" +
          "I can help you with:\n" +
          "• University policies &amp; procedures\n" +
          "• IT &amp; technology questions\n" +
          "• Campus services &amp; schedules\n" +
          "• General academic guidance\n" +
          "• Protected student actions after login\n\n" +
          "<b>Commands</b>\n" +
          "• /login — link your student account\n" +
          "• /logout — unlink your student account\n" +
          "• /me — show linked student account\n" +
          "• /cancel — cancel current login flow\n"
      );
      return;
    }

    await getOrCreateActiveSession(userId, chatId);

    if (command === "/cancel") {
      await clearLoginState(userId);
      await updateSession(userId, {
        pending_action: null,
      });

      await sendTelegramMessage(chatId, "Current action has been cancelled.");
      return;
    }

    if (command === "/login") {
      await startLoginFlow(userId);
      await sendTelegramMessage(chatId, "Please enter your Student ID.");
      return;
    }

    if (command === "/logout") {
      await unlinkTelegramAccount(userId);

      await updateSession(userId, {
        linked_student_id: null,
        pending_action: null,
        login_state: null,
        temp_student_id: null,
      });

      await sendTelegramMessage(
        chatId,
        "Your student account has been unlinked successfully."
      );
      return;
    }

    if (command === "/me") {
      const linked = await getLinkedStudentByTelegramUserId(userId);

      if (!linked) {
        await sendTelegramMessage(
          chatId,
          "No student account is currently linked.\nUse /login to connect your account."
        );
        return;
      }

      const { student } = linked;

      await sendTelegramMessage(
        chatId,
        `<b>Linked Account</b>\n` +
          `Student ID: <code>${student.student_id}</code>\n` +
          `Name: ${student.full_name}\n` +
          `Faculty: ${student.faculty || "-"}\n` +
          `Major: ${student.major || "-"}\n` +
          `Role: ${student.role}`
      );
      return;
    }

    await sendTelegramMessage(
      chatId,
      "Unknown command. Type /help to see what I can do."
    );
  } catch (error) {
    console.error("commandHandler error:", error.message);
    await sendTelegramMessage(
      chatId,
      "Sorry, command handling failed. Please try again."
    );
  }
}