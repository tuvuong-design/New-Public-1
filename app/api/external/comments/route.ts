import { NextRequest, NextResponse } from "next/server";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { canInteractWithVideoDb, canViewVideoDb } from "@/lib/videoAccessDb";
import { sessionFromJwt } from "@/lib/api/externalAuth";
import { z } from "zod";

export const runtime = "nodejs";

const postSchema = z.object({
  videoId: z.string().min(1),
  content: z.string().min(1).max(5000),
});

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["COMMENT_READ","COMMENT_WRITE","PUBLIC_READ"] });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function GET(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["COMMENT_READ","PUBLIC_READ"] });
  if (!g.ok) return g.res;

  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId");
  if (!videoId) return withCors(jsonError(400, "Missing videoId"), g.origin);

  const session = sessionFromJwt(g.user as any);
  const viewerId = g.user?.sub;
  const isAdmin = g.user?.role === "ADMIN";

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, status: true, access: true, interactionsLocked: true, authorId: true, deletedAt: true },
  });
  if (!video) return withCors(NextResponse.json({ ok: true, comments: [] }), g.origin);

  if (!(await canViewVideoDb(video as any, session))) return withCors(jsonError(403, "Forbidden"), g.origin);

  const canModerate = Boolean(isAdmin || (viewerId && viewerId === video.authorId));

  const comments = await prisma.comment.findMany({
    where: { videoId, ...(canModerate ? { visibility: { not: "DELETED" } } : { visibility: "VISIBLE" }) },
    orderBy: [
      { isPinned: "desc" },
      { pinnedAt: "desc" },
      { isHearted: "desc" },
      { heartedAt: "desc" },
      { isSuperThanks: "desc" },
      { superThanksStars: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      user: { select: { name: true, id: true, membershipTier: true, membershipExpiresAt: true } },
    },
    take: 200,
  });

  return withCors(NextResponse.json({ ok: true, comments }), g.origin);
}

export async function POST(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["COMMENT_WRITE"], requireAuth: true });
  if (!g.ok) return g.res;

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return withCors(jsonError(400, "Invalid input", parsed.error.flatten()), g.origin);

  const userId = g.user!.sub;
  const session = sessionFromJwt(g.user as any);

  // Anti-spam: respect ban/mute
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { bannedAt: true, mutedUntil: true, name: true } });
  const now = new Date();
  if (u?.bannedAt) return withCors(jsonError(403, "Account banned"), g.origin);
  if (u?.mutedUntil && u.mutedUntil.getTime() > now.getTime()) return withCors(jsonError(403, "You are muted"), g.origin);

  const video = await prisma.video.findUnique({
    where: { id: parsed.data.videoId },
    select: { id: true, status: true, access: true, interactionsLocked: true, authorId: true, deletedAt: true },
  });
  if (!video) return withCors(jsonError(404, "Video not found"), g.origin);

  if (!(await canViewVideoDb(video as any, session))) return withCors(jsonError(403, "Forbidden"), g.origin);
  if (!(await canInteractWithVideoDb(video as any, session))) return withCors(jsonError(403, "Interactions disabled"), g.origin);

  // Keyword filter per creator
  let visibility: "VISIBLE" | "HIDDEN" = "VISIBLE";
  if (video.authorId) {
    const s = await prisma.creatorModerationSetting.findUnique({ where: { creatorId: video.authorId }, select: { keywordsCsv: true } });
    const kw = (s?.keywordsCsv || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (kw.length) {
      const lower = parsed.data.content.toLowerCase();
      if (kw.some((k) => lower.includes(k.toLowerCase()))) visibility = "HIDDEN";
    }
  }

  const c = await prisma.comment.create({
    data: {
      videoId: parsed.data.videoId,
      content: parsed.data.content,
      userId,
      visibility,
      moderatedAt: visibility === "HIDDEN" ? new Date() : null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await prisma.video.update({ where: { id: parsed.data.videoId }, data: { commentCount: { increment: 1 } } });

  return withCors(NextResponse.json({ ok: true, comment: c }), g.origin);
}
