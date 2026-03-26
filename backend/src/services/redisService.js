import Redis from "ioredis";
import { logInfo, logError } from "../utils/logger.js";

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 10000,
  retryStrategy: (times) => {
    return Math.min(times * 200, 3000);
  },
  reconnectOnError: (err) => {
    if (err.message.includes("READONLY")) {
      return true;
    }
    return false;
  },
});

let connectPromise = null;

export async function ensureRedisReady() {
  if (redis.status === "ready") return;

  if (!connectPromise) {
    connectPromise = redis.connect().catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  await connectPromise;
}

redis.on("connect", () => {
  logInfo("Redis connected successfully");
});

redis.on("ready", () => {
  logInfo("Redis ready");
});

redis.on("error", (err) => {
  logError("Redis connection error", { error: err.message });
});

redis.on("reconnecting", () => {
  logInfo("Redis reconnecting...");
});

const SESSION_TTL = 24 * 60 * 60;
const MESSAGE_TTL = 7 * 24 * 60 * 60;
const MEMORY_TTL = 30 * 24 * 60 * 60;
const SUMMARY_TTL = 7 * 24 * 60 * 60;

// =================================================================
// SESSION MANAGEMENT
// =================================================================

export async function getOrCreateActiveSession(telegramUserId, telegramChatId) {
  await ensureRedisReady();

  const userId = String(telegramUserId);
  const chatId = telegramChatId ? String(telegramChatId) : null;
  const key = `session:${userId}`;

  try {
    const existing = await redis.get(key);

    if (existing) {
      const session = JSON.parse(existing);

      if (chatId && session.telegram_chat_id !== chatId) {
        session.telegram_chat_id = chatId;
        session.updated_at = new Date().toISOString();
        await redis.setex(key, SESSION_TTL, JSON.stringify(session));
      }

      return session;
    }

    const newSession = {
      id: `session_${userId}_${Date.now()}`,
      telegram_user_id: userId,
      telegram_chat_id: chatId,
      channel: "telegram",
      status: "active",
      current_step: 0,
      login_state: null,
      temp_student_id: null,
      linked_student_id: null,
      pending_action: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await redis.setex(key, SESSION_TTL, JSON.stringify(newSession));
    return newSession;
  } catch (error) {
    logError("Redis getOrCreateActiveSession error", { error: error.message });
    throw error;
  }
}

export async function updateSession(telegramUserId, updates = {}) {
  await ensureRedisReady();

  const userId = String(telegramUserId);
  const key = `session:${userId}`;

  try {
    const existing = await redis.get(key);
    if (!existing) {
      throw new Error("Session not found");
    }

    const session = JSON.parse(existing);
    const updated = {
      ...session,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await redis.setex(key, SESSION_TTL, JSON.stringify(updated));
    return updated;
  } catch (error) {
    logError("Redis updateSession error", { error: error.message });
    throw error;
  }
}

export async function closeSession(telegramUserId) {
  await ensureRedisReady();

  const userId = String(telegramUserId);
  const key = `session:${userId}`;

  try {
    const existing = await redis.get(key);
    if (!existing) return null;

    const session = JSON.parse(existing);
    session.status = "closed";
    session.updated_at = new Date().toISOString();

    await redis.setex(key, 60 * 60, JSON.stringify(session));
    return session;
  } catch (error) {
    logError("Redis closeSession error", { error: error.message });
    throw error;
  }
}

// =================================================================
// MESSAGE HISTORY
// =================================================================

export async function createMessage({ sessionId, role, content, metadata = {} }) {
  await ensureRedisReady();

  const key = `messages:${sessionId}`;

  try {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      session_id: sessionId,
      role,
      content,
      metadata,
      created_at: new Date().toISOString(),
    };

    await redis.rpush(key, JSON.stringify(message));
    await redis.ltrim(key, -50, -1);
    await redis.expire(key, MESSAGE_TTL);

    return message;
  } catch (error) {
    logError("Redis createMessage error", { error: error.message });
    throw error;
  }
}

export async function getRecentMessages(sessionId, limit = 6) {
  await ensureRedisReady();

  const key = `messages:${sessionId}`;

  try {
    const messages = await redis.lrange(key, -limit, -1);

    if (!messages || messages.length === 0) {
      return [];
    }

    return messages
      .map((msg) => {
        try {
          const parsed = JSON.parse(msg);
          return {
            role: parsed.role,
            parts: [{ text: parsed.content }],
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    logError("Redis getRecentMessages error", { error: error.message });
    return [];
  }
}

export async function getMessageCount(sessionId) {
  await ensureRedisReady();

  const key = `messages:${sessionId}`;

  try {
    return await redis.llen(key);
  } catch (error) {
    logError("Redis getMessageCount error", { error: error.message });
    return 0;
  }
}

// =================================================================
// MEMORY
// =================================================================

export async function saveMemoryItems({ telegramUserId, memories = [] }) {
  await ensureRedisReady();

  if (!memories.length) return [];

  const userId = String(telegramUserId);
  const key = `memory:${userId}`;

  try {
    const saved = [];

    for (const memory of memories) {
      const memoryId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const item = {
        id: memoryId,
        memory_type: memory.type,
        content: memory.content,
        importance_score: 0.7,
        created_at: new Date().toISOString(),
      };

      await redis.hset(key, memoryId, JSON.stringify(item));
      saved.push(item);
    }

    await redis.expire(key, MEMORY_TTL);

    return saved;
  } catch (error) {
    logError("Redis saveMemoryItems error", { error: error.message });
    return [];
  }
}

export async function getRelevantMemory(telegramUserId, limit = 5) {
  await ensureRedisReady();

  const userId = String(telegramUserId);
  const key = `memory:${userId}`;

  try {
    const allMemory = await redis.hgetall(key);

    if (!allMemory || Object.keys(allMemory).length === 0) {
      return [];
    }

    return Object.values(allMemory)
      .map((item) => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  } catch (error) {
    logError("Redis getRelevantMemory error", { error: error.message });
    return [];
  }
}

// =================================================================
// SUMMARIES
// =================================================================

export async function saveSummary({ sessionId, summaryText, coveredUntilMessageId }) {
  await ensureRedisReady();

  const key = `summary:${sessionId}`;

  try {
    const summary = {
      session_id: sessionId,
      summary_text: summaryText,
      covered_until_message_id: coveredUntilMessageId,
      summary_type: "rolling",
      created_at: new Date().toISOString(),
    };

    await redis.setex(key, SUMMARY_TTL, JSON.stringify(summary));
    return summary;
  } catch (error) {
    logError("Redis saveSummary error", { error: error.message });
    return null;
  }
}

export async function getLatestSummary(sessionId) {
  await ensureRedisReady();

  const key = `summary:${sessionId}`;

  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logError("Redis getLatestSummary error", { error: error.message });
    return null;
  }
}

export async function shouldCreateSummary(sessionId, triggerCount = 8) {
  await ensureRedisReady();

  try {
    const messageCount = await getMessageCount(sessionId);
    if (messageCount < triggerCount) return false;

    const summary = await getLatestSummary(sessionId);
    if (!summary) return true;

    const coveredId = summary.covered_until_message_id || "";
    const key = `messages:${sessionId}`;
    const allMessages = await redis.lrange(key, 0, -1);

    const newMessages = allMessages.filter((msg) => {
      try {
        const parsed = JSON.parse(msg);
        return parsed.id > coveredId;
      } catch {
        return false;
      }
    });

    return newMessages.length >= triggerCount;
  } catch (error) {
    logError("Redis shouldCreateSummary error", { error: error.message });
    return false;
  }
}

export async function getMessagesForSummary(sessionId, limit = 12) {
  await ensureRedisReady();

  const key = `messages:${sessionId}`;

  try {
    const messages = await redis.lrange(key, -limit, -1);

    return messages
      .map((msg) => {
        try {
          return JSON.parse(msg);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    logError("Redis getMessagesForSummary error", { error: error.message });
    return [];
  }
}

// =================================================================
// HEALTH
// =================================================================

export async function healthCheck() {
  try {
    await ensureRedisReady();

    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    return {
      status: "healthy",
      latency: `${latency}ms`,
      connected: true,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error.message,
      connected: false,
    };
  }
}

export async function getRedisStats() {
  try {
    await ensureRedisReady();

    const info = await redis.info("stats");
    const dbsize = await redis.dbsize();

    return {
      dbsize,
      info,
      memory: await redis.info("memory"),
    };
  } catch (error) {
    logError("Redis getRedisStats error", { error: error.message });
    return null;
  }
}

export default redis;