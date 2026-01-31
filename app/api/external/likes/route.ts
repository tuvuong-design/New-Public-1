import { NextRequest, NextResponse } from "next/server";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { canInteractWithVideoDb, canViewVideoDb } from "@/lib/videoAccessDb";
import { sessionFromJwt } from "@/lib/api/externalAuth";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({ videoId: z.string().min(1) });

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["LIKE_WRITE"], requireAuth: true });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function POST(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["LIKE_WRITE"], requireAuth: true });
  if (!g.ok) return g.res;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return withCors(jsonError(400, "Invalid input", parsed.error.flatten()), g.origin);

  const userId = g.user!.sub;
  const session = sessionFromJwt(g.user as any);

  const video = await prisma.video.findUnique({
    where: { id: parsed.data.videoId },
    select: { id: true, status: true, access: true, interactionsLocked: true, authorId: true, deletedAt: true },
  });
  if (!video) return withCors(jsonError(404, "Video not found"), g.origin);

  if (!(await canViewVideoDb(video as any, session))) return withCors(jsonError(403, "Forbidden"), g.origin);
  if (!(await canInteractWithVideoDb(video as any, session))) return withCors(jsonError(403, "Interactions disabled"), g.origin);

  const existing = await prisma.like.findUnique({ where: { userId_videoId: { userId, videoId: parsed.data.videoId } } });

  if (existing) {
    await prisma.like.delete({ where: { userId_videoId: { userId, videoId: parsed.data.videoId } } });
    await prisma.video.update({ where: { id: parsed.data.videoId }, data: { likeCount: { decrement: 1 } } });
    return withCors(NextResponse.json({ ok: true, liked: false }), g.origin);
  }

  await prisma.like.create({ data: { userId, videoId: parsed.data.videoId } });
  await prisma.video.update({ where: { id: parsed.data.videoId }, data: { likeCount: { increment: 1 } } });
  return withCors(NextResponse.json({ ok: true, liked: true }), g.origin);
}
