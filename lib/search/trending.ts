import { getRedis } from "@/lib/redis";

function yyyymmdd(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function trendingKeyForDate(d: Date) {
  return `videoshare:search:trending:v1:${yyyymmdd(d)}`;
}

export async function recordSearchQuery(queryRaw: string) {
  const q = String(queryRaw || "").trim();
  if (q.length < 2) return;
  // Limit to keep Redis tidy + avoid abusive payloads.
  const normalized = q.slice(0, 80);

  const redis = getRedis();
  if (!redis) return;

  try {
    const key = trendingKeyForDate(new Date());
    // ZSET score = count
    await redis.zincrby(key, 1, normalized);
    // Keep a short retention window (e.g., 14 days) for trending.
    await redis.expire(key, 60 * 60 * 24 * 14);
  } catch {
    // Best-effort only; never block search.
  }
}

export async function getTrendingQueries(opts?: { date?: Date; limit?: number }) {
  const date = opts?.date ?? new Date();
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);

  const redis = getRedis();
  if (!redis) return { date: yyyymmdd(date), items: [] as { q: string; count: number }[] };

  const key = trendingKeyForDate(date);
  const raw = await redis.zrevrange(key, 0, limit - 1, "WITHSCORES");
  const items: { q: string; count: number }[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    items.push({ q: raw[i], count: Number(raw[i + 1] || 0) });
  }
  return { date: yyyymmdd(date), items };
}
