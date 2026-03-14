import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { logInfo } from "../utils/logger.js";

// How long a cached answer is considered fresh
const TTL_HOURS = 24;

/**
 * Normalize a question for consistent cache key generation.
 * "What is the tuition fee?" and "what is the tuition fee" → same hash.
 */
function normalizeQuestion(question) {
  return question
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")  // strip punctuation
    .replace(/\s+/g, " ");     // collapse whitespace
}

function hashQuestion(normalized) {
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Try to get a cached answer for a question.
 * Returns the answer string if found and not expired, null otherwise.
 */
export async function getCachedAnswer(question) {
  const hash = hashQuestion(normalizeQuestion(question));

  const { data, error } = await supabaseAdmin
    .from("response_cache")
    .select("id, answer")
    .eq("question_hash", hash)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) return null;

  // Increment hit counter using raw SQL (fire-and-forget)
  supabaseAdmin.rpc("increment_cache_hit", { cache_id: data.id }).then(() => {});

  logInfo("Response cache HIT", { question: question.slice(0, 80), hash });

  return data.answer;
}

/**
 * Store a question → answer pair in the cache.
 * Uses upsert so re-asking an expired question refreshes the TTL.
 */
export async function setCachedAnswer(question, answer) {
  const normalized = normalizeQuestion(question);
  const hash = hashQuestion(normalized);
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from("response_cache")
    .upsert(
      {
        question_hash: hash,
        question: normalized,
        answer,
        expires_at: expiresAt,
        hit_count: 0,
      },
      { onConflict: "question_hash" }
    );

  if (error) {
    console.error("responseCache.setCachedAnswer error:", error.message);
    return;
  }

  logInfo("Response cache SET", { question: question.slice(0, 80), hash, expiresAt });
}

/**
 * Delete all expired cache entries.
 * Called periodically by the cache cleanup worker.
 */
export async function purgeExpiredCache() {
  const { error, count } = await supabaseAdmin
    .from("response_cache")
    .delete({ count: "exact" })
    .lt("expires_at", new Date().toISOString());

  if (error) {
    console.error("responseCache.purgeExpiredCache error:", error.message);
    return;
  }

  if (count > 0) {
    logInfo("Response cache purged", { deletedRows: count });
  }
}