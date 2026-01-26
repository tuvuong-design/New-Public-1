import { getRedis } from "@/lib/redis";

export async function rateLimitRedis(key: string, limit: number, windowSeconds: number) {
  const redis = getRedis();
  if (!redis) return { ok: true, remaining: limit - 1 };
  const k = `videoshare:rl:${key}`;
  try {
    const count = await redis.incr(k);
    if (count === 1) {
      await redis.expire(k, Math.max(1, Math.floor(windowSeconds)));
    }
    const remaining = Math.max(0, limit - count);
    return { ok: count <= limit, remaining };
  } catch {
    // Fail open
    return { ok: true, remaining: limit - 1 };
  }
}
