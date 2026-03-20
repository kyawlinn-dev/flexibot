import { supabaseAdmin } from "../lib/supabase.js";
import { model } from "./aiService.js";

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

/**
 * Extract important long-term memory from one conversation turn.
 */
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

/**
 * Save extracted memory items.
 */
export async function saveMemoryItems({
  telegramUserId,
  sessionId,
  sourceMessageId = null,
  memories = [],
}) {
  if (!memories.length) return [];

  const rows = memories.map((m) => ({
    telegram_user_id: String(telegramUserId),
    session_id: sessionId,
    source_message_id: sourceMessageId,
    memory_type: m.type,
    content: m.content.trim(),
    importance_score: 0.7,
  }));

  const { data, error } = await supabaseAdmin
    .from("memory_items")
    .insert(rows)
    .select();

  if (error) {
    console.error("memoryService.saveMemoryItems error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Get recently stored active memory items for this user.
 * v1 = simple recency-based retrieval
 */
export async function getRelevantMemory(telegramUserId, limit = 5) {
  const { data, error } = await supabaseAdmin
    .from("memory_items")
    .select("id, memory_type, content, updated_at")
    .eq("telegram_user_id", String(telegramUserId))
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("memoryService.getRelevantMemory error:", error.message);
    return [];
  }

  return data || [];
}