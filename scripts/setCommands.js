import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function setCommands() {

  const commands = [
    { command: "start", description: "Start the bot" },
    { command: "help", description: "Show help" }
  ];

  await axios.post(
    `https://api.telegram.org/bot${TOKEN}/setMyCommands`,
    { commands }
  );

  console.log("Commands registered");
}

setCommands();