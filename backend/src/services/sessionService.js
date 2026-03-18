import { supabaseAdmin } from "../lib/supabase.js";

/**
 * Get the latest active session for a Telegram user.
 * If none exists, create a new active session.
 */
export async function getOrCreateActiveSession(telegramUserId, telegramChatId) {
  const userId = String(telegramUserId);
  const chatId = telegramChatId ? String(telegramChatId) : null;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("telegram_user_id", userId)
    .eq("channel", "telegram")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("sessionService.getOrCreateActiveSession fetch error:", fetchError.message);
    throw fetchError;
  }

  if (existing) {
    if (chatId && existing.telegram_chat_id !== chatId) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("sessions")
        .update({
          telegram_chat_id: chatId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        console.error("sessionService.getOrCreateActiveSession update error:", updateError.message);
        throw updateError;
      }

      return updated;
    }

    return existing;
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from("sessions")
    .insert({
      telegram_user_id: userId,
      telegram_chat_id: chatId,
      channel: "telegram",
      status: "active",
      current_step: 0,
    })
    .select()
    .single();

  if (insertError) {
    console.error("sessionService.getOrCreateActiveSession insert error:", insertError.message);
    throw insertError;
  }

  return created;
}

/**
 * Update selected session fields.
 */
export async function updateSession(sessionId, updates = {}) {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .update(payload)
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    console.error("sessionService.updateSession error:", error.message);
    throw error;
  }

  return data;
}

/**
 * Set the login state for a session.
 * Example values:
 * - awaiting_student_id
 * - awaiting_password
 * - null
 */
export async function setLoginState(sessionId, loginState, tempStudentId = null) {
  return await updateSession(sessionId, {
    login_state: loginState,
    temp_student_id: tempStudentId,
  });
}

/**
 * Clear login-related temporary fields.
 */
export async function clearLoginState(sessionId) {
  return await updateSession(sessionId, {
    login_state: null,
    temp_student_id: null,
  });
}

/**
 * Set a pending action waiting for confirmation.
 * Example:
 * - create_ticket_confirmation
 */
export async function setPendingAction(sessionId, actionName) {
  return await updateSession(sessionId, {
    pending_action: actionName,
  });
}

/**
 * Clear any pending action.
 */
export async function clearPendingAction(sessionId) {
  return await updateSession(sessionId, {
    pending_action: null,
  });
}

/**
 * Close a session.
 */
export async function closeSession(sessionId) {
  return await updateSession(sessionId, {
    status: "closed",
    pending_action: null,
    login_state: null,
    temp_student_id: null,
  });
}