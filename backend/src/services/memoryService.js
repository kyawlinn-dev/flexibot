import { model } from "./aiService.js";
import {
  saveMemoryItems as saveMemoryItemsToRedis,
  getRelevantMemory,
} from "./redisService.js";

export { getRelevantMemory };

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

export async function extractMemory({ userText, assistantText }) {
  const prompt = `
Extract important long-term memory from this conversation.

Only include:
- user goals
- user preferences
- project context
- identity-related information that may matter later

Do NOT include:
- greetings
- small talk
- temporary one-time questions
- short-lived details

Return ONLY a valid JSON array in this format:
[
  { "type": "preference|goal|context|identity", "content": "..." }
]

Conversation:
USER: ${userText}
ASSISTANT: ${assistantText}
`.trim();

  try {
    const result = await model.generateContent(prompt);
    const text = extractTextFromResult(result);

    if (!text) return [];

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.type === "string" &&
        typeof item.content === "string" &&
        item.content.trim().length > 0
    );
  } catch (error) {
    console.error("memoryService.extractMemory error:", error.message);
    return [];
  }
}

export async function saveMemoryItems({
  telegramUserId,
  sessionId,
  sourceMessageId = null,
  memories = [],
}) {
  return saveMemoryItemsToRedis({
    telegramUserId,
    sessionId,
    sourceMessageId,
    memories,
  });
}