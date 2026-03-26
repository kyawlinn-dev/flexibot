import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../lib/supabase.js";
import {
  clearLoginState,
  updateSession,
} from "./sessionService.js";

export async function findStudentByStudentId(studentId) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) {
    console.error("authService.findStudentByStudentId error:", error.message);
    throw error;
  }

  return data;
}

export async function verifyStudentCredentials(studentId, password) {
  const student = await findStudentByStudentId(studentId);

  if (!student) {
    return { ok: false, reason: "Student ID not found." };
  }

  const isValid = await bcrypt.compare(password, student.password_hash);

  if (!isValid) {
    return { ok: false, reason: "Incorrect password." };
  }

  if (student.status !== "active") {
    return { ok: false, reason: "This account is not active." };
  }

  return { ok: true, student };
}

export async function linkTelegramAccount({
  telegramUserId,
  telegramChatId,
  studentId,
}) {
  const userId = String(telegramUserId);
  const chatId = telegramChatId ? String(telegramChatId) : null;

  const { data, error } = await supabaseAdmin
    .from("telegram_links")
    .upsert(
      {
        telegram_user_id: userId,
        telegram_chat_id: chatId,
        student_id: studentId,
        is_active: true,
        linked_at: new Date().toISOString(),
      },
      { onConflict: "telegram_user_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("authService.linkTelegramAccount error:", error.message);
    throw error;
  }

  return data;
}

export async function getLinkedStudentByTelegramUserId(telegramUserId) {
  const userId = String(telegramUserId);

  const { data: link, error: linkError } = await supabaseAdmin
    .from("telegram_links")
    .select("*")
    .eq("telegram_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (linkError) {
    console.error("authService.getLinkedStudentByTelegramUserId link error:", linkError.message);
    throw linkError;
  }

  if (!link) return null;

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("*")
    .eq("student_id", link.student_id)
    .maybeSingle();

  if (studentError) {
    console.error("authService.getLinkedStudentByTelegramUserId student error:", studentError.message);
    throw studentError;
  }

  if (!student) return null;

  return { link, student };
}

export async function unlinkTelegramAccount(telegramUserId) {
  const userId = String(telegramUserId);

  const { error } = await supabaseAdmin
    .from("telegram_links")
    .update({ is_active: false })
    .eq("telegram_user_id", userId)
    .eq("is_active", true);

  if (error) {
    console.error("authService.unlinkTelegramAccount error:", error.message);
    throw error;
  }

  return true;
}

export async function startLoginFlow(telegramUserId) {
  return updateSession(telegramUserId, {
    login_state: "awaiting_student_id",
    temp_student_id: null,
    pending_action: null,
  });
}

export async function handleLoginFlow({
  session,
  telegramUserId,
  telegramChatId,
  text,
}) {
  const trimmed = text.trim();

  if (session.login_state === "awaiting_student_id") {
    await updateSession(telegramUserId, {
      login_state: "awaiting_password",
      temp_student_id: trimmed,
    });

    return {
      handled: true,
      reply: "Please enter your password.",
    };
  }

  if (session.login_state === "awaiting_password") {
    const studentId = session.temp_student_id;

    if (!studentId) {
      await clearLoginState(telegramUserId);

      return {
        handled: true,
        reply: "Login session expired. Please type /login and try again.",
      };
    }

    const result = await verifyStudentCredentials(studentId, trimmed);

    if (!result.ok) {
      await clearLoginState(telegramUserId);

      return {
        handled: true,
        reply: `Login failed: ${result.reason}\nPlease type /login to try again.`,
      };
    }

    await linkTelegramAccount({
      telegramUserId,
      telegramChatId,
      studentId: result.student.student_id,
    });

    await updateSession(telegramUserId, {
      linked_student_id: result.student.student_id,
      login_state: null,
      temp_student_id: null,
      pending_action: null,
      summary: `Authenticated as ${result.student.student_id}`,
    });

    return {
      handled: true,
      reply: `Login successful. Welcome, ${result.student.full_name}! Your Telegram account is now linked.`,
      student: result.student,
    };
  }

  return {
    handled: false,
    reply: null,
  };
}