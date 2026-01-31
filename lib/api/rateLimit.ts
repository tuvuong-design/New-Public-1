import { env } from "@/lib/env";
import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

// Simple fixed-window limiter: key => count within windowSec
export async function rateLimit(req: NextRequest, opts: { key: string; limit: number; windowSec: number }) {
  const redis = getRedis();
  if (!redis) {
    // fail-open in non-redis env
    return { ok: true as const, remaining: opts.limit, resetMs: Date.now() + opts.windowSec * 1000 };
  }

  const now = Date.now();
  const bucket = `${opts.key}:${Math.floor(now / (opts.windowSec * 1000))}`;
  const multi = redis.multi();
  multi.incr(bucket);
  multi.ttl(bucket);
  const [count, ttl] = (await multi.exec())?.map((x) => x[1]) as [number, number];

  if (ttl === -1) await redis.expire(bucket, opts.windowSec);

  const remaining = Math.max(0, opts.limit - count);
  const resetMs = now + (ttl > 0 ? ttl * 1000 : opts.windowSec * 1000);

  return { ok: count <= opts.limit, remaining, resetMs };
}

export function ipKey(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.ip ?? "unknown";
}
