import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { incDailyMetric } from "@/lib/metrics";
import { incBoostStat } from "@/lib/boost";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { rateLimit, ipKey } from "@/lib/api/rateLimit";

export const runtime = "nodejs";
const schema = z.object({ videoId: z.string().min(1) });

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["VIEW_WRITE"], strictScopes: true });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function POST(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["VIEW_WRITE"], strictScopes: true });
  if (!g.ok) return g.res;

  const rl = await rateLimit(req, { key: `rl:ext:views:${ipKey(req)}:${g.apiKey.id}`, limit: 600, windowSec: 60 });
  if (!rl.ok) return withCors(jsonError(429, "Rate limit exceeded"), g.origin);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return withCors(jsonError(400, "Invalid input", parsed.error.flatten()), g.origin);

  await prisma.$transaction(async (tx) => {
    await tx.video.update({ where: { id: parsed.data.videoId }, data: { viewCount: { increment: 1 } } });
    await incDailyMetric(tx as any, parsed.data.videoId, "views", 1);
    await incBoostStat(tx as any, parsed.data.videoId, "statViews", 1);
  });

  return withCors(NextResponse.json({ ok: true }), g.origin);
}
