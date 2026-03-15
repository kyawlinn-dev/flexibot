import { supabaseAdmin } from "../lib/supabase.js";

// How many messages (user + model turns combined) to keep per user
const MAX_HISTORY = 20;

/**
 * Load the last MAX_HISTORY messages for a user from Supabase.
 * Returns them in Gemini content format: [{ role, parts: [{ text }] }]
 */
export async function getHistory(userId) {
  const { data, error } = await supabaseAdmin
    .from("conversation_history")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY);

  if (error) {
    console.error("conversationStore.getHistory error:", error.message);
    return []; // Fail open — missing history is better than a crash
  }

  // Rows come back newest-first; reverse so they're chronological
  return data.reverse().map((row) => ({
    role: row.role,
    parts: [{ text: row.content }],
  }));
}

/**
 * Append a single message to the user's history.
 * Also prunes rows beyond MAX_HISTORY to keep the table tidy.
 */
export async function pushToHistory(userId, role, text) {
  // 1. Insert the new message
  const { error: insertError } = await supabaseAdmin
    .from("conversation_history")
    .insert({ user_id: userId, role, content: text });

  if (insertError) {
    console.error("conversationStore.pushToHistory insert error:", insertError.message);
    return;
  }

  // 2. Prune: keep only the latest MAX_HISTORY rows for this user
  // Uses a subquery to find the cutoff id, then deletes older ones
  const { data: rows } = await supabaseAdmin
    .from("conversation_history")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(MAX_HISTORY, MAX_HISTORY); // the row just past the limit

  if (rows && rows.length > 0) {
    const cutoffId = rows[0].id;

    await supabaseAdmin
      .from("conversation_history")
      .delete()
      .eq("user_id", userId)
      .lt("id", cutoffId);
  }
}

/**
 * Wipe all conversation history across all users.
 * Called when a knowledge document is deleted — any conversations that
 * referenced that document are now stale and should not influence future answers.
 */
export async function clearAllConversations() {
  const { error, count } = await supabaseAdmin
    .from("conversation_history")
    .delete({ count: "exact" })
    .gte("id", 0); // matches every row

  if (error) {
    console.error("conversationStore.clearAllConversations error:", error.message);
    return;
  }

  console.log(`Conversation history cleared after document deletion (${count} rows removed)`);
}