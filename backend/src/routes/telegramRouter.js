// src/routes/telegramRouter.js

import express from "express";
import { handleCommand } from "../handlers/commandHandler.js";
import { handleText } from "../handlers/textHandler.js";
import { handleImage } from "../handlers/imageHandler.js";
import { logError } from "../utils/logger.js";

// ✅ ADD THESE IMPORTS
import { sendTelegramMessage } from "../services/telegramService.js";
import { startLoginFlow } from "../services/authService.js";
import { clearLoginState } from "../services/sessionService.js";
import { getLinkedStudentByTelegramUserId } from "../services/authService.js";

const router = express.Router();

function verifyTelegramSignature(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!secret) {
    console.log("TELEGRAM_WEBHOOK_SECRET is missing");
    return true;
  }

  const incoming = req.get("x-telegram-bot-api-secret-token");
  return incoming === secret;
}

router.post("/", async (req, res) => {
  if (!verifyTelegramSignature(req)) {
    logError("Webhook signature mismatch — request rejected");
    return res.sendStatus(401);
  }

  // ✅ HANDLE BUTTON CLICKS (callback_query)
  const callback = req.body?.callback_query;

  if (callback) {
    const data = callback.data;
    const chatId = callback.message.chat.id;
    const userId = String(callback.from.id);

    try {
      if (data === "login") {
        await startLoginFlow(userId);
        await sendTelegramMessage(
          chatId,
          "🔐 Please enter your Student ID."
        );
      }

      if (data === "faq") {
        await sendTelegramMessage(
          chatId,
          "📚 <b>FAQ</b>\n\nChoose a question:",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "How to login?", callback_data: "faq_login" }],
                [{ text: "Reset password?", callback_data: "faq_password" }],
                [{ text: "Contact support", callback_data: "faq_support" }]
              ]
            }
          }
        );
      }

     if (data === "faq_login") {
      await sendTelegramMessage(
        chatId,
        "👉 <b>To login:</b>\n\n" +
        "1. Click Login\n" +
        "2. Enter your Student ID\n" +
        "3. Enter your password",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔐 Login", callback_data: "login" }],
              [{ text: "⬅ Back", callback_data: "faq" }]
            ]
          }
        }
      );
    }

      if (data === "faq_password") {
        await sendTelegramMessage(
          chatId,
          "🔑 <b>Password Help</b>\n\nPlease contact IT support.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "📞 Contact Support", callback_data: "faq_support" }],
                [{ text: "⬅ Back", callback_data: "faq" }]
              ]
            }
          }
        );
      }

      if (data === "faq_support") {
        await sendTelegramMessage(
          chatId,
          "📞 Contact IT Support:\nEmail: support@rsu.ac.th"
        );
      }

      if (data === "me") {
        const linked = await getLinkedStudentByTelegramUserId(userId);

        if (!linked) {
          await sendTelegramMessage(
            chatId,
            "No account linked. Use Login first."
          );
        } else {
          const { student } = linked;

          await sendTelegramMessage(
            chatId,
            `👤 <b>Your Account</b>\n` +
              `Student ID: <code>${student.student_id}</code>\n` +
              `Name: ${student.full_name}`
          );
        }
      }

      if (data === "cancel") {
        await clearLoginState(userId);
        await sendTelegramMessage(chatId, "❌ Cancelled");
      }

      return res.sendStatus(200);
    } catch (error) {
      logError("Callback error", {
        error: error.message,
        stack: error.stack,
      });
      return res.sendStatus(200);
    }
  }

  // ✅ EXISTING MESSAGE HANDLING
  const message = req.body?.message;

  res.sendStatus(200);

  if (!message) return;

  try {
    if (message.text?.startsWith("/")) {
      await handleCommand(message);
      return;
    }

    if (message.photo?.length) {
      await handleImage(message);
      return;
    }

    if (message.text) {
      await handleText(message);
      return;
    }
  } catch (error) {
    logError("Router error", {
      error: error.message,
      stack: error.stack,
    });
  }
});

export default router;