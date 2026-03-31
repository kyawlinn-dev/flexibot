import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const MAX_LENGTH = 4000;

// ===============================
// FORMATTER (FIXED)
// ===============================

function formatToTelegramHTML(text) {
  let html = text;

  // ✅ Code blocks ```
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    let trimmed = code.trim();

    // Prevent Telegram collapsing short code
    if (!trimmed.includes("\n")) {
      trimmed += " ".repeat(10);
    }

    return `<pre>\n${trimmed}\n</pre>`;
  });

  // ✅ Inline code `
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // ✅ Bold **
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  // ✅ Headers #
  html = html.replace(/^#+\s+(.*?)$/gm, "<b>$1</b>");

  return html;
}

// ===============================
// SPLIT LONG MESSAGE
// ===============================

function splitMessage(text) {
  const parts = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    parts.push(text.slice(i, i + MAX_LENGTH));
  }
  return parts;
}

// ===============================
// SEND MESSAGE (SUPPORT BUTTONS)
// ===============================

export async function sendTelegramMessage(chatId, text, options = {}) {
  const parts = splitMessage(text);

  for (const part of parts) {
    try {
      await axios.post(`${BASE_URL}/sendMessage`, {
        chat_id: chatId,
        text: formatToTelegramHTML(part), // ✅ formatted correctly
        parse_mode: "HTML", // ✅ REQUIRED
        reply_markup: options.reply_markup || undefined, // ✅ buttons
      });
    } catch (error) {
      console.error(
        "Telegram send error:",
        error.response?.data || error.message
      );
    }
  }
}

// ===============================
// THINKING MESSAGE
// ===============================

export async function sendThinking(chatId) {
  try {
    const res = await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: chatId,
      text: "🤖 <i>Thinking...</i>",
      parse_mode: "HTML",
    });

    return res.data.result.message_id;
  } catch (error) {
    console.error(
      "sendThinking error:",
      error.response?.data || error.message
    );
    return null;
  }
}

// ===============================
// EDIT MESSAGE
// ===============================

export async function editTelegramMessage(chatId, messageId, text) {
  const parts = splitMessage(text);

  try {
    // Edit first message
    await axios.post(`${BASE_URL}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text: formatToTelegramHTML(parts[0]),
      parse_mode: "HTML",
    });

    // Send remaining parts if long
    for (let i = 1; i < parts.length; i++) {
      await sendTelegramMessage(chatId, parts[i]);
    }
  } catch (error) {
    console.error(
      "Edit message error:",
      error.response?.data || error.message
    );
  }
}

// ===============================
// TELEGRAM FILE HANDLING (IMAGE)
// ===============================

export async function getFileLink(fileId) {
  try {
    const res = await axios.get(`${BASE_URL}/getFile`, {
      params: { file_id: fileId },
    });

    return res.data.result.file_path;
  } catch (error) {
    console.error(
      "Get file link error:",
      error.response?.data || error.message
    );
    throw error;
  }
}

export async function downloadFile(filePath) {
  try {
    const url = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;

    const res = await axios.get(url, {
      responseType: "arraybuffer",
    });

    return Buffer.from(res.data).toString("base64");
  } catch (error) {
    console.error("Download file error:", error.message);
    throw error;
  }
}