import { supabaseAdmin } from "../lib/supabase.js";
import { model } from "./aiService.js";

const SUMMARY_TRIGGER_COUNT = 8;
const SUMMARY_SOURCE_LIMIT = 12;

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
 * Get latest summary for a session.
 */
export async function getLatestSummary(sessionId) {
  const { data, error } = await supabaseAdmin
    .from("conversation_summaries")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("summaryService.getLatestSummary error:", error.message);
    return null;
  }

  return data;
}

/**
 * Count messages in a session.
 */
export async function getSessionMessageCount(sessionId) {
  const { count, error } = await supabaseAdmin
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .in("role", ["user", "model"]);

  if (error) {
    console.error("summaryService.getSessionMessageCount error:", error.message);
    return 0;
  }

  return count || 0;
}

/**
 * Get recent raw messages for summary generation.
 */
export async function getMessagesForSummary(sessionId, limit = SUMMARY_SOURCE_LIMIT) {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .in("role", ["user", "model"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("summaryService.getMessagesForSummary error:", error.message);
    return [];
  }

  return data.reverse();
}

/**
 * Decide whether we should create a rolling summary now.
 */
export async function shouldCreateSummary(sessionId) {
  const count = await getSessionMessageCount(sessionId);
  if (count === 0) return false;

  const latestSummary = await getLatestSummary(sessionId);

  if (!latestSummary) {
    return count >= SUMMARY_TRIGGER_COUNT;
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("session_id", sessionId)
    .gt("id", latestSummary.covered_until_message_id || 0)
    .in("role", ["user", "model"]);

  if (error) {
    console.error("summaryService.shouldCreateSummary error:", error.message);
    return false;
  }

  return (data?.length || 0) >= SUMMARY_TRIGGER_COUNT;
}

/**
 * Generate summary text using Gemini.
 */
export async function generateRollingSummary(sessionId) {
  const latestSummary = await getLatestSummary(sessionId);
  const messages = await getMessagesForSummary(sessionId);

  if (!messages.length) return null;

  const previousSummary = latestSummary?.summary_text || "No previous summary.";
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

Previous summary:
${previousSummary}

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

/**
 * Save one summary row.
 */
export async function saveSummary({
  sessionId,
  telegramUserId,
  summaryText,
  coveredUntilMessageId,
  summaryType = "rolling",
}) {
  const { data, error } = await supabaseAdmin
    .from("conversation_summaries")
    .insert({
      session_id: sessionId,
      telegram_user_id: String(telegramUserId),
      summary_type: summaryType,
      summary_text: summaryText,
      covered_until_message_id: coveredUntilMessageId,
    })
    .select()
    .single();

  if (error) {
    console.error("summaryService.saveSummary error:", error.message);
    return null;
  }

  return data;
}