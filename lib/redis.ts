import IORedis from "ioredis";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var _videoshare_redis: IORedis | undefined;
}

/**
 * Lazily create a singleton Redis client.
 *
 * Notes
 * - Returns `null` if `REDIS_URL` is not configured (to support Install Wizard).
 * - Uses `globalThis` to avoid opening multiple connections in dev / HMR.
 */
export function getRedis() {
  if (!env.REDIS_URL) return null;

  if (!globalThis._videoshare_redis) {
    globalThis._videoshare_redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  return globalThis._videoshare_redis;
}

export async function redisGetJSON<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function redisSetJSON(key: string, value: unknown, ttlSeconds: number) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const payload = JSON.stringify(value);
    await redis.set(key, payload, "EX", Math.max(1, Math.floor(ttlSeconds)));
  } catch {
    // ignore
  }
}

export async function redisDel(...keys: string[]) {
  const redis = getRedis();
  if (!redis) return;
  try {
    if (keys.length) await redis.del(...keys);
  } catch {
    // ignore
  }
}
