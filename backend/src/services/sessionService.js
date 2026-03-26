import {
  getOrCreateActiveSession,
  updateSession,
  closeSession,
} from "./redisService.js";

export { getOrCreateActiveSession, updateSession, closeSession };

export async function setLoginState(telegramUserId, loginState, tempStudentId = null) {
  return updateSession(telegramUserId, {
    login_state: loginState,
    temp_student_id: tempStudentId,
  });
}

export async function clearLoginState(telegramUserId) {
  return updateSession(telegramUserId, {
    login_state: null,
    temp_student_id: null,
  });
}

export async function setPendingAction(telegramUserId, actionName) {
  return updateSession(telegramUserId, {
    pending_action: actionName,
  });
}

export async function clearPendingAction(telegramUserId) {
  return updateSession(telegramUserId, {
    pending_action: null,
  });
}