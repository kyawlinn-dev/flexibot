// src/services/directReplyService.js

function normalizeText(text = "") {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getDirectReply(text, { isLoggedIn = false } = {}) {
  const normalized = normalizeText(text);

  if (!normalized) return null;

  // Greetings
  if (/^(hi|hello|hey|helo|yo|mingalarpar|mingalar par)$/.test(normalized)) {
    return isLoggedIn
      ? "👋 Hello! You're connected. Ask me anything about RSU, IT, or student-related help."
      : "👋 Hello! Ask me about RSU, IT, or university information.\n\nUse /login if you want protected student actions.";
  }

  // Thanks
  if (/^(thanks|thank you|thx|ty|thank u)$/.test(normalized)) {
    return "You're welcome 😊";
  }

  // Bye
  if (/^(bye|goodbye|see ya|see you|gn|good night)$/.test(normalized)) {
    return "Good luck with your work 👋";
  }

  // Bot identity
  if (
    /^(who are you|what are you|what can you do|what do you do)$/.test(
      normalized
    )
  ) {
    return (
      "🤖 I’m the RSU AI Assistant.\n\n" +
      "I can help with:\n" +
      "• University information\n" +
      "• IT support guidance\n" +
      "• Campus-related questions\n" +
      "• Protected student features after /login"
    );
  }

  // Quick login guidance without AI
  if (
    /^(how to login|login|log in|how can i login|how do i login)$/.test(
      normalized
    )
  ) {
    return isLoggedIn
      ? "You are already logged in. Use /me to see your linked account, or /logout to unlink it."
      : "To link your student account, type /login";
  }

  // Help without AI
  if (/^(help|menu|commands)$/.test(normalized)) {
    return (
      "🤖 RSU AI Assistant\n\n" +
      "Commands:\n" +
      "• /start\n" +
      "• /help\n" +
      "• /login\n" +
      "• /logout\n" +
      "• /me\n" +
      "• /cancel"
    );
  }

  return null;
}