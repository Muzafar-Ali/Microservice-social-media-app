import { createClient } from "redis";
import config from "./config.js";

export const redis = createClient({ url: config.redisUrl });

redis.on("error", (err) => {
  // In production you might integrate this into your logger.
  console.error("❌ Redis error in chat-service:", err);
});

export async function initRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    console.log("✅ Redis connected (chat-service)");
  }
}