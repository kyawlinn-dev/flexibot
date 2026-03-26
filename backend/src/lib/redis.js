// src/lib/redis.js
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not set in environment variables.");
}

export const redis = createClient({
  url: redisUrl,
});

redis.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

let connected = false;

export async function connectRedis() {
  if (connected) return redis;

  await redis.connect();
  connected = true;
  console.log("✅ Redis connected");

  return redis;
}