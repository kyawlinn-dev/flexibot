import express from "express";
import dotenv from "dotenv";
import telegramRouter from "./routes/telegramRouter.js";

dotenv.config();

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("AI Assistant API is running");
});

app.use("/webhook", telegramRouter);

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});