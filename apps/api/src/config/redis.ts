/**
 * IOREDIS SINGLETON
 * Used for: caching, BullMQ queues, rate limit storage, session storage.
 * Exposes small helper wrappers for common JSON cache operations.
 */
import Redis from "ioredis";
import { env } from "./env";

const globalRedis = globalThis as unknown as { redis?: Redis };

export const redis: Redis =
  globalRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    showFriendlyErrorStack: true,
    connectionName: "ecom-api",
  });

if (env.NODE_ENV !== "production") globalRedis.redis = redis;

redis.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("❌ Redis connection error:", err.message);
});

/* ------------- Cache helpers (JSON) ------------- */

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await redis.del(key);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 300,
): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(...keys: string[]): Promise<number> {
  if (!keys.length) return 0;
  return redis.del(keys);
}

export async function cacheInvalidateByPrefix(prefix: string): Promise<number> {
  let cursor = "0";
  let deleted = 0;
  do {
    const [next, keys] = await redis.scan(0, "MATCH", `${prefix}*`, "COUNT", 500);
    cursor = next;
    if (keys.length) deleted += await redis.del(...keys);
  } while (cursor !== "0");
  return deleted;
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
