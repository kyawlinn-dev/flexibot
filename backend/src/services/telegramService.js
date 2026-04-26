import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const MAX_LENGTH = 4000;

// ===============================
// FORMATTER (FIXED)
// ===============================

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatToTelegramHTML(text) {
  let html = text;

  // ── STEP 1: Save ```code blocks``` as placeholders ────────────
  // Must be first — protects code from ALL other processing steps
  const codeBlocks = [];
  html = html.replace(/```([^\n]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `\x00BLOCK${codeBlocks.length}\x00`;
    lang = lang.trim();
    let escaped = escapeHTML(code.trim());
    if (!escaped.includes("\n")) escaped += "          "; // prevent Telegram collapse
    const label = lang ? `\n<code>${lang}</code>` : "";
    codeBlocks.push(`<pre>${label}\n${escaped}\n</pre>`);
    return placeholder;
  });

  // ── STEP 2: Strip unsupported raw HTML tags from model output ──
  const ALLOWED_TAGS = new Set(["b","i","u","s","code","pre","a","tg-spoiler"]);
  const BLOCK_TAGS   = new Set(["div","p","ul","ol","li","h1","h2","h3","h4","h5","h6","br","hr","section","article","table","tr","td","th","thead","tbody","span","figure","img"]);
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?>/g, (match, tag) => {
    const t = tag.toLowerCase();
    if (ALLOWED_TAGS.has(t)) return match;
    if (BLOCK_TAGS.has(t))   return "\n";
    return "";
  });

  // ── STEP 3: Markdown tables → plain text ──────────────────────
  html = html.replace(/(\|[^\n]+\|\n?)+/g, (block) => {
    const lines = block.trim().split("\n");
    const rows = [];
    for (const line of lines) {
      if (/^\s*\|[-:\s|]+\|\s*$/.test(line)) continue; // skip separator
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length) rows.push(cells.join("  "));
    }
    return rows.join("\n") + "\n";
  });

  // ── STEP 4: Blockquotes > text → italic ───────────────────────
  html = html.replace(/^>\s+(.+)$/gm, "<i>$1</i>");

  // ── STEP 5: Horizontal rules → blank line ─────────────────────
  html = html.replace(/^[ \t]*(-{3,}|_{3,}|\*{3,})[ \t]*$/gm, "");

  // ── STEP 6: Bold+italic ***text*** ────────────────────────────
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>");

  // ── STEP 7: Bold+code **`code`** → <code> only ────────────────
  // Telegram rejects nested <b><code></code></b>
  html = html.replace(/\*\*`([^`\n]+)`\*\*/g, (_, code) => `<code>${escapeHTML(code)}</code>`);

  // ── STEP 8: Inline code `...` ─────────────────────────────────
  html = html.replace(/`([^`\n]+)`/g, (_, code) => `<code>${escapeHTML(code)}</code>`);

  // ── STEP 9: Headers # → <b> (BEFORE bold step to avoid nesting) 
  html = html.replace(/^#{1,6}\s+(.+)$/gm, (_, inner) => {
    inner = inner.replace(/\*\*(.+?)\*\*/g, "$1"); // strip ** inside header
    inner = inner.replace(/_(.+?)_/g, "$1");        // strip _ inside header
    return `\n<b>${inner.trim()}</b>`;
  });

  // ── STEP 10: Standalone **bold line** → section header ────────
  html = html.replace(/^[ \t]*\*\*([^*\n]+)\*\*[ \t]*$/gm, "\n<b>$1</b>");

  // ── STEP 11: Remaining bold **text** ──────────────────────────
  html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

  // ── STEP 12: Italic *text* (single star, not bullet) ──────────
  html = html.replace(/(?<!\*)\*(?!\*|\s)(.+?)(?<!\s)\*(?!\*)/g, "<i>$1</i>");

  // ── STEP 13: Italic _text_ ────────────────────────────────────
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<i>$1</i>");

  // ── STEP 14: Strikethrough ~~text~~ → <s> ─────────────────────
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // ── STEP 15: Links [text](url) → <a href> ─────────────────────
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2">$1</a>');

  // ── STEP 16: Numbered lists — keep numbers, just clean spacing ─
  html = html.replace(/^[ \t]*(\d+)\.\s+/gm, "$1. ");

  // ── STEP 17: Nested bullets (2+ spaces indent) → ◦ ───────────
  html = html.replace(/^[ \t]{2,}[\*\-]\s+/gm, "   ◦ ");

  // ── STEP 18: Top-level bullets * and - → • ────────────────────
  html = html.replace(/^[ \t]*[\*\-]\s+/gm, "• ");

  // ── STEP 19: Restore code blocks ──────────────────────────────
  codeBlocks.forEach((block, i) => {
    html = html.replace(`\x00BLOCK${i}\x00`, block);
  });

  // ── STEP 20: Final whitespace cleanup ─────────────────────────
  html = html.replace(/[ \t]+\n/g, "\n");   // trailing spaces
  html = html.replace(/\n{3,}/g, "\n\n");   // max 2 blank lines
  return html.trim();
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