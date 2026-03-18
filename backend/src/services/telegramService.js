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

  // 1. Escape HTML special chars first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Fenced code blocks  ```lang\ncode```
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    let trimmed = code.trim();
    // Add trailing spaces on single-line blocks to prevent Telegram's </> icon overlap
    if (!trimmed.includes("\n")) {
      trimmed += " ".repeat(20);
    }
    const langClass = lang ? ` class="language-${lang}"` : "";
    return `<pre><code${langClass}>${trimmed}</code></pre>`;
  });

  // 3. Inline code  `code`
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 4. Bold  **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  // 5. Markdown headers → bold
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
      console.error(
        "Telegram send error:",
        error.response?.data || error.message
      );
    }
  }
}


/* ------------------------------------------------------------------ */
/* Typing Indicator                                                      */
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
/* Thinking Message                                                      */
/* ------------------------------------------------------------------ */

export async function sendThinking(chatId) {
  try {
    const res = await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: chatId,
      text: "🤖 <i>Thinking...</i>",
      parse_mode: "HTML",
    });
    return res.data.result.message_id;
  } catch (error) {
    console.error("Thinking message error:", error.message);
  }
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

    // Send any overflow parts as new messages
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