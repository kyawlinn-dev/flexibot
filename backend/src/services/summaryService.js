import { model } from "./aiService.js";
import {
  saveSummary as saveSummaryToRedis,
  getLatestSummary,
  shouldCreateSummary,
  getMessagesForSummary,
} from "./redisService.js";

export { getLatestSummary, shouldCreateSummary };

function extractTextFromResult(result) {
  try {
    return (
      result?.response?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || ""
    );
  } catch {
    return "";
  }
}

export async function generateRollingSummary(sessionId) {
  const messages = await getMessagesForSummary(sessionId, 12);

  if (!messages || messages.length === 0) return null;

  const latestMessageId = messages[messages.length - 1]?.id || null;

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const prompt = `
You are creating a rolling conversation summary for an AI assistant memory system.

Write a concise summary of this conversation that preserves:
- the user's main goal
- important facts or preferences
- current topic
- unresolved questions
- decisions already made

Rules:
- Keep it short but useful
- Do not invent facts
- Prefer durable context over small talk
- Output plain text only

Recent conversation:
${transcript}
  `.trim();

  try {
    const result = await model.generateContent(prompt);
    const text = extractTextFromResult(result);

    if (!text) return null;

    return {
      summaryText: text,
      coveredUntilMessageId: latestMessageId,
    };
  } catch (error) {
    console.error("summaryService.generateRollingSummary error:", error.message);
    return null;
  }
}

export async function saveSummary({
  sessionId,
  summaryText,
  coveredUntilMessageId,
}) {
  return saveSummaryToRedis({
    sessionId,
    summaryText,
    coveredUntilMessageId,
  });
}