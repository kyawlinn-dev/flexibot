import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const MAX_LENGTH = 4000;

/* ---------------- HTML Formatter ---------------- */

function formatToTelegramHTML(text) {
  // 1. Escape HTML chars first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, p1, p2) => {
    let code = p2.trim();
    // Add horizontal space to prevent Telegram's copy icon (</>) from overlapping short single-line code
    if (!code.includes('\n')) {
      code += ' '.repeat(20);
    }
    const langClass = p1 ? ` class="language-${p1}"` : '';
    return `<pre><code${langClass}>${code}</code></pre>`;
  });

  // 3. Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 4. Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  // 5. Italic (avoid matching within words or bullet points)
  // html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');

  // 6. Headers (convert to bold)
  html = html.replace(/^#+\s+(.*?)$/gm, '<b>$1</b>');

  return html;
}

/* ---------------- Split Long Messages ---------------- */

function splitMessage(text) {

  const parts = [];

  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    parts.push(text.slice(i, i + MAX_LENGTH));
  }

  return parts;

}

/* ---------------- Send Message ---------------- */

export async function sendTelegramMessage(chatId, text) {

  const parts = splitMessage(text);

  for (const part of parts) {

    try {

      await axios.post(`${BASE_URL}/sendMessage`, {
        chat_id: chatId,
        text: formatToTelegramHTML(part),
        parse_mode: "HTML"
      });

    } catch (error) {

      console.error(
        "Telegram send error:",
        error.response?.data || error.message
      );

    }

  }

}

/* ---------------- Typing Indicator ---------------- */

export async function sendTyping(chatId) {

  try {

    await axios.post(`${BASE_URL}/sendChatAction`, {
      chat_id: chatId,
      action: "typing"
    });

  } catch (error) {

    console.error("Typing indicator error:", error.message);

  }

}

/* ---------------- Thinking Message ---------------- */

export async function sendThinking(chatId) {

  try {

    const res = await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: chatId,
      text: "🤖 <i>Thinking...</i>",
      parse_mode: "HTML"
    });

    return res.data.result.message_id;

  } catch (error) {

    console.error("Thinking message error:", error.message);

  }

}

/* ---------------- Edit Message ---------------- */

export async function editTelegramMessage(chatId, messageId, text) {

  const parts = splitMessage(text);

  try {

    await axios.post(`${BASE_URL}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text: formatToTelegramHTML(parts[0]),
      parse_mode: "HTML"
    });

    if (parts.length > 1) {

      for (let i = 1; i < parts.length; i++) {

        await sendTelegramMessage(chatId, parts[i]);

      }

    }

  } catch (error) {

    console.error(
      "Edit message error:",
      error.response?.data || error.message
    );

  }

}

/* ---------------- Get File Link ---------------- */

export async function getFileLink(fileId) {
  try {
    const res = await axios.get(`${BASE_URL}/getFile`, {
      params: { file_id: fileId }
    });
    return res.data.result.file_path;
  } catch (error) {
    console.error("Get file link error:", error.response?.data || error.message);
    throw error;
  }
}

/* ---------------- Download File ---------------- */

export async function downloadFile(filePath) {
  try {
    const url = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(res.data).toString('base64');
  } catch (error) {
    console.error("Download file error:", error.message);
    throw error;
  }
}
