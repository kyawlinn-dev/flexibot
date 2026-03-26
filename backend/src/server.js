import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import telegramRouter from "./routes/telegramRouter.js";
import adminDocumentsRouter from "./routes/adminDocumentsRouter.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { startRagStatusWorker } from "./workers/ragStatusWorker.js";

dotenv.config();

const REQUIRED_ENV = [
  "TELEGRAM_BOT_TOKEN",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_LOCATION",
  "RAG_CORPUS_NAME",
  "GCS_BUCKET_NAME",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REDIS_URL",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `[FATAL] Missing required environment variables: ${missing.join(", ")}\n` +
    `Copy backend/.env.example to backend/.env and fill in all values.`
  );
  process.exit(1);
}

const app = express();

app.use(
  cors({
    origin: process.env.ADMIN_DASHBOARD_URL || "http://localhost:3001",
    credentials: true,
  })
);

app.use(express.json());

app.use("/webhook", telegramRouter);
app.use("/api/admin", authMiddleware, adminDocumentsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  if (process.env.ENABLE_RAG_STATUS_WORKER === "true") {
    startRagStatusWorker();
  }
});