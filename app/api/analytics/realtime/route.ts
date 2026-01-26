import { NextResponse } from "next/server";
import { z } from "zod";
import { getRedis } from "@/lib/redis";
import { analyticsKeys } from "@/lib/analytics/keys";

const querySchema = z.object({
  videoId: z.string().min(1),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ videoId: url.searchParams.get("videoId") });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: true, count: 0 });

  const key = analyticsKeys.realtimeViewers(parsed.data.videoId);
  const now = Date.now();
  const cutoff = now - 60_000;

  try {
    await redis.zremrangebyscore(key, 0, cutoff);
    const count = await redis.zcard(key);
    return NextResponse.json({ ok: true, count });
  } catch {
    return NextResponse.json({ ok: true, count: 0 });
  }
}
