// src/routes/telegramRouter.js

import express from "express";
import { handleCommand } from "../handlers/commandHandler.js";
import { handleText } from "../handlers/textHandler.js";
import { handleImage } from "../handlers/imageHandler.js";
import { logError } from "../utils/logger.js";

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