// ============================================================
// scripts/setCommands.js
// Run once to register bot commands with Telegram.
// Usage: node scripts/setCommands.js
// ============================================================

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

const commands = [
  { command: "start", description: "Start the RSU AI Assistant" },
  { command: "help", description: "Show available help and features" },
];

async function setCommands() {
  try {
    const res = await axios.post(`${BASE_URL}/setMyCommands`, { commands });
    console.log("✅ Bot commands registered successfully:", res.data);
  } catch (error) {
    console.error("❌ Failed to register commands:", error.response?.data || error.message);
  }
}

setCommands();