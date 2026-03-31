import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing in .env");
  process.exit(1);
}

const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

const commands = [
  { command: "start", description: "🚀 Start bot" },
  { command: "help", description: "❓ Help" },
  { command: "logout", description: "🚪 Logout" },
];

async function setCommands() {
  try {
    const res = await axios.post(`${BASE_URL}/setMyCommands`, { commands });
    console.log("✅ Bot commands registered successfully:", res.data);
  } catch (error) {
    console.error(
      "❌ Failed to register commands:",
      error.response?.data || error.message
    );
  }
}

setCommands();