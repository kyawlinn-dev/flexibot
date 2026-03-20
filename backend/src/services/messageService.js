import { supabaseAdmin } from "../lib/supabase.js";

const RECENT_HISTORY_LIMIT = 6;

/**
 * Save one chat message into the new messages table.
 */
export async function createMessage({
  sessionId,
  telegramUserId,
  role,
  content,
  metadata = {},
}) {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      session_id: sessionId,
      telegram_user_id: String(telegramUserId),
      role,
      content,
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.error("messageService.createMessage error:", error.message);
    throw error;
  }

  return data;
}

/**
 * Return the most recent messages for a session
 * in Gemini history format: [{ role, parts: [{ text }] }]
 */
export async function getRecentMessages(sessionId, limit = RECENT_HISTORY_LIMIT) {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .in("role", ["user", "model"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("messageService.getRecentMessages error:", error.message);
    return [];
  }

  return data
    .reverse()
    .map((row) => ({
      role: row.role,
      parts: [{ text: row.content }],
    }));
}

/**
 * Optional helper for debugging or future features.
 */
export async function getRecentRawMessages(sessionId, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("messageService.getRecentRawMessages error:", error.message);
    return [];
  }

  return data.reverse();
}