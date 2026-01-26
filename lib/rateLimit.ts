import { getRedis } from "@/lib/redis";

// Contract: Redis key prefix must be preserved.
export const RATE_LIMIT_KEY_PREFIX = "videoshare:ratelimit:";

// Fallback (when Redis is not configured, e.g. Install Wizard)
const mem = new Map<string, { count: number; resetAt: number }>();

function normalizeKey(bucketKey: string) {
  const k = String(bucketKey || "").trim();
  if (!k) return RATE_LIMIT_KEY_PREFIX + "anonymous";
  return k.startsWith(RATE_LIMIT_KEY_PREFIX) ? k : RATE_LIMIT_KEY_PREFIX + k;
}

/**
 * Fixed-window rate limit.
 * - Uses Redis when available.
 * - Falls back to in-memory map when Redis is missing.
 */
export async function rateLimit(bucketKey: string, limit: number, windowMs: number) {
  const key = normalizeKey(bucketKey);
  const now = Date.now();
  const win = Math.max(1000, Math.floor(windowMs));
  const lim = Math.max(1, Math.floor(limit));

  const redis = getRedis();
  if (!redis) {
    const item = mem.get(key);
    if (!item || item.resetAt < now) {
      mem.set(key, { count: 1, resetAt: now + win });
      return { ok: true, remaining: lim - 1, resetAt: now + win };
    }
    if (item.count >= lim) return { ok: false, remaining: 0, resetAt: item.resetAt };
    item.count += 1;
    return { ok: true, remaining: Math.max(0, lim - item.count), resetAt: item.resetAt };
  }

  // Redis fixed-window counter
  try {
    const multi = redis.multi();
    multi.incr(key);
    multi.pttl(key);
    const out = (await multi.exec()) as any[] | null;
    const count = Number(out?.[0]?.[1] ?? 0);
    let pttl = Number(out?.[1]?.[1] ?? -1);

    // First hit or key without TTL => set TTL
    if (count === 1 || pttl < 0) {
      await redis.pexpire(key, win);
      pttl = win;
    }

    const resetAt = now + Math.max(0, pttl);
    const remaining = Math.max(0, lim - count);
    const ok = count <= lim;
    return { ok, remaining, resetAt };
  } catch {
    // As last resort, allow.
    return { ok: true, remaining: lim - 1, resetAt: now + win };
  }
}
