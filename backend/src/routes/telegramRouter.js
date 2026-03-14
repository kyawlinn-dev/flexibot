import express from "express";
import crypto from "crypto";

import { handleCommand } from "../handlers/commandHandler.js";
import { handleText } from "../handlers/textHandler.js";
import { handleImage } from "../handlers/imageHandler.js";
import { logError } from "../utils/logger.js";

const router = express.Router();

// S3 fix: verify Telegram webhook signature so only real Telegram
// requests are processed. Set TELEGRAM_WEBHOOK_SECRET in .env to the
// same secret token you passed to setWebhook.
// If the env var is not set the check is skipped (safe for local dev).
function verifyTelegramSignature(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;

  const incoming = req.headers["x-telegram-bot-api-secret-token"];
  return incoming === secret;
}

router.post("/", async (req, res) => {

  if (!verifyTelegramSignature(req)) {
    logError("Webhook signature mismatch — request rejected");
    return res.sendStatus(401);
  }

  const message = req.body.message;

  res.sendStatus(200); // Acknowledge Telegram immediately

  if (!message) return;

  try {

    // B4 fix: all handlers must be awaited so errors bubble up to this
    // try/catch and get logged instead of silently disappearing
    if (message.text && message.text.startsWith("/")) {
      await handleCommand(message);
    }

    else if (message.photo) {
      await handleImage(message);
    }

    else if (message.text) {
      await handleText(message);
    }

  } catch (error) {
    logError("Router error", { error: error.message });
  }

});

export default router;