import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import telegramRouter from "./routes/telegramRouter.js";
import adminDocumentsRouter from "./routes/adminDocumentsRouter.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { startRagStatusWorker } from "./workers/ragStatusWorker.js";
import { purgeExpiredCache } from "./services/responseCache.js";

dotenv.config();

// ── Startup env validation ────────────────────────────────────────────────────
// Fail fast rather than silently mis-behaving at runtime.
const REQUIRED_ENV = [
  "TELEGRAM_BOT_TOKEN",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_LOCATION",
  "RAG_CORPUS_NAME",
  "GCS_BUCKET_NAME",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `[FATAL] Missing required environment variables: ${missing.join(", ")}\n` +
    `Copy backend/.env.example to backend/.env and fill in all values.`
  );
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

app.use(
  cors({
    origin: process.env.ADMIN_DASHBOARD_URL || "http://localhost:3001",
    credentials: true,
  })
);

app.use(express.json());

app.use("/webhook", telegramRouter);

// authMiddleware verifies the Supabase JWT on every admin request.
// Any request without a valid "Authorization: Bearer <token>" header
// is rejected with 401 before it reaches the router.
app.use("/api/admin", authMiddleware, adminDocumentsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startRagStatusWorker();

  // Purge expired response cache entries every 6 hours
  purgeExpiredCache();
  setInterval(purgeExpiredCache, 6 * 60 * 60 * 1000);
});