import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import telegramRouter from "./routes/telegramRouter.js";
import adminDocumentsRouter from "./routes/adminDocumentsRouter.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.ADMIN_DASHBOARD_URL || "http://localhost:3001",
    credentials: true,
  })
);

app.use(express.json());

app.use("/webhook", telegramRouter);
app.use("/api/admin", adminDocumentsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});