import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const MAX_LENGTH = 4000;


/* ------------------------------------------------------------------ */
/* HTML Formatter                                                        */
/* ------------------------------------------------------------------ */

function formatToTelegramHTML(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    let trimmed = code.trim();
    if (!trimmed.includes("\n")) {
      trimmed += " ".repeat(20);
    }
    const langClass = lang ? ` class="language-${lang}"` : "";
    return `<pre><code${langClass}>${trimmed}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  html = html.replace(/^#+\s+(.*?)$/gm, "<b>$1</b>");

  return html;
}


/* ------------------------------------------------------------------ */
/* Split Long Messages                                                   */
/* ------------------------------------------------------------------ */

function splitMessage(text) {
  const parts = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    parts.push(text.slice(i, i + MAX_LENGTH));
  }
  return parts;
}


/* ------------------------------------------------------------------ */
/* Send Message                                                          */
/* ------------------------------------------------------------------ */

export async function sendTelegramMessage(chatId, text) {
  const parts = splitMessage(text);
  for (const part of parts) {
    try {
      await axios.post(`${BASE_URL}/sendMessage`, {
        chat_id: chatId,
        text: part,
        parse_mode: "HTML",
      });
    } catch (error) {
      console.error("Telegram send error:", error.response?.data || error.message);
    }
  }
}


/* ------------------------------------------------------------------ */
/* Typing Indicator (kept for any future use)                           */
/* ------------------------------------------------------------------ */

export async function sendTyping(chatId) {
  try {
    await axios.post(`${BASE_URL}/sendChatAction`, {
      chat_id: chatId,
      action: "typing",
    });
  } catch (error) {
    console.error("Typing indicator error:", error.message);
  }
}


/* ------------------------------------------------------------------ */
/* Thinking Message — animated dots + persistent typing indicator       */
/*                                                                      */
/* Flow:                                                                 */
/*   1. Sends "🤖 Thinking." message immediately                        */
/*   2. Fires typing action immediately (shows pencil in chat header)   */
/*   3. Cycles dots every 1500ms  .  →  ..  →  ...  →  .  → …         */
/*      (1500ms is safe — Telegram allows ~1 edit/sec per chat)         */
/*   4. Refreshes typing indicator every 4s (Telegram clears it at 5s) */
/*   5. Returns { messageId, stop }                                     */
/*      — call stop() then editTelegramMessage() when answer is ready  */
/* ------------------------------------------------------------------ */

const THINKING_FRAMES = [
  "🤖 <i>Thinking.</i>",
  "🤖 <i>Thinking..</i>",
  "🤖 <i>Thinking...</i>",
];

export async function sendThinkingAnimated(chatId) {
  // Send the initial "Thinking." message
  let messageId = null;
  try {
    const res = await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: chatId,
      text: THINKING_FRAMES[0],
      parse_mode: "HTML",
    });
    messageId = res.data.result.message_id;
  } catch (error) {
    console.error("sendThinkingAnimated send error:", error.message);
    return { messageId: null, stop: () => {} };
  }

  let stopped = false;
  let frameIdx = 0;

  // Fire typing action immediately so the pencil appears right away
  axios.post(`${BASE_URL}/sendChatAction`, {
    chat_id: chatId,
    action: "typing",
  }).catch(() => {});

  // Refresh typing indicator every 4s so it never auto-disappears
  const typingInterval = setInterval(() => {
    if (stopped) return;
    axios.post(`${BASE_URL}/sendChatAction`, {
      chat_id: chatId,
      action: "typing",
    }).catch(() => {});
  }, 4000);

  // Animate the dots every 1500ms — safe for Telegram's 1 edit/sec limit
  const dotInterval = setInterval(async () => {
    if (stopped) return;
    frameIdx = (frameIdx + 1) % THINKING_FRAMES.length;
    try {
      await axios.post(`${BASE_URL}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text: THINKING_FRAMES[frameIdx],
        parse_mode: "HTML",
      });
    } catch {
      // Silently ignore — a racing final-answer edit can cause a benign error here
    }
  }, 1500);

  const stop = () => {
    stopped = true;
    clearInterval(typingInterval);
    clearInterval(dotInterval);
  };

  return { messageId, stop };
}


/* ------------------------------------------------------------------ */
/* Edit Message                                                          */
/* ------------------------------------------------------------------ */

export async function editTelegramMessage(chatId, messageId, text) {
  const parts = splitMessage(text);

  try {
    await axios.post(`${BASE_URL}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text: formatToTelegramHTML(parts[0]),
      parse_mode: "HTML",
    });

    for (let i = 1; i < parts.length; i++) {
      await sendTelegramMessage(chatId, parts[i]);
    }
  } catch (error) {
    console.error("Edit message error:", error.response?.data || error.message);
  }
}


/* ------------------------------------------------------------------ */
/* Get File Link                                                         */
/* ------------------------------------------------------------------ */

export async function getFileLink(fileId) {
  try {
    const res = await axios.get(`${BASE_URL}/getFile`, {
      params: { file_id: fileId },
    });
    return res.data.result.file_path;
  } catch (error) {
    console.error("Get file link error:", error.response?.data || error.message);
    throw error;
  }
}


/* ------------------------------------------------------------------ */
/* Download File (returns base64)                                        */
/* ------------------------------------------------------------------ */

export async function downloadFile(filePath) {
  try {
    const url = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
    const res = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(res.data).toString("base64");
  } catch (error) {
    console.error("Download file error:", error.message);
    throw error;
  }
}