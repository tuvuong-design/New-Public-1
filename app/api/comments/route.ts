import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canInteractWithVideoDb, canViewVideoDb } from "@/lib/videoAccessDb";
import { grantXp } from "@/lib/gamification/grantXp";
import { getViewerFanClubTier } from "@/lib/creatorFanClub";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId");
  if (!videoId) {
    return Response.json({ error: "Missing videoId" }, { status: 400 });
  }

  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      status: true,
      access: true,
      interactionsLocked: true,
      authorId: true,
      deletedAt: true,
    },
  });

  if (!video) {
    return Response.json({ comments: [] }, { status: 200 });
  }

  const canView = await canViewVideoDb(video as any, session);
  if (!canView) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const canModerate = Boolean(isAdmin || (viewerId && viewerId === video.authorId));

  const viewerFanClubTier = viewerId && video.authorId && viewerId !== video.authorId
    ? await getViewerFanClubTier(viewerId, video.authorId)
    : null;

  // Compute TOP SUPPORTER for this video (sum of Super Thanks stars per user).
  // Requirement: show TOP SUPPORTER only for Diamond comment (>50 stars) AND the largest supporter for this video.
  const grouped = await prisma.comment.groupBy({
    by: ["userId"],
    where: { videoId, isSuperThanks: true, userId: { not: null }, visibility: { not: "DELETED" } },
    _sum: { superThanksStars: true },
    orderBy: { _sum: { superThanksStars: "desc" } },
    take: 1,
  });

  const topSupporterUserId = grouped?.[0]?.userId ?? null;
  const topSupporterStars = grouped?.[0]?._sum?.superThanksStars ?? 0;

  const comments = await prisma.comment.findMany({
    where: {
      videoId,
      ...(canModerate ? { visibility: { not: "DELETED" } } : { visibility: "VISIBLE" }),
    },
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
      starTx: { select: { note: true } },
    },
    take: 200,
  });

  // Fan Club badge: active CreatorMembership for this video's creator.
  const commenterIds = Array.from(new Set(comments.map((c) => c.userId).filter(Boolean))) as string[];
  const fanClubMap = new Map<string, string>();

  if (commenterIds.length && video.authorId) {
    const now = new Date();
    const memberships = await prisma.creatorMembership.findMany({
      where: {
        creatorId: video.authorId,
        userId: { in: commenterIds },
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      select: { userId: true, plan: { select: { tier: true } } },
    });
    for (const m of memberships) {
      fanClubMap.set(m.userId, m.plan.tier);
    }
  }


  function parseAnonymous(note: string | null | undefined): boolean {
    if (!note) return false;
    try {
      const obj = JSON.parse(note);
      return Boolean(obj?.anonymous);
    } catch {
      return false;
    }
  }

  const out = comments.map((c) => {
    const senderAnonymous = c.isSuperThanks ? parseAnonymous(c.starTx?.note) : false;
    const isTopSupporter = Boolean(
      topSupporterUserId &&
        topSupporterStars > 0 &&
        c.isSuperThanks &&
        (c.superThanksStars ?? 0) > 50 &&
        c.userId &&
        c.userId === topSupporterUserId
    );

    return {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      isPinned: Boolean((c as any).isPinned),
      isHearted: Boolean((c as any).isHearted),
      isSuperThanks: Boolean(c.isSuperThanks),
      superThanksStars: c.superThanksStars ?? 0,
      superThanksQty: c.superThanksQty ?? 1,
      senderAnonymous,
      isTopSupporter,
      user: c.user
        ? {
            id: c.user.id,
            name: c.user.name,
            membershipTier: c.user.membershipTier,
            membershipExpiresAt: c.user.membershipExpiresAt ? c.user.membershipExpiresAt.toISOString() : null,
            fanClubTier: c.userId ? (fanClubMap.get(c.userId) ?? null) : null,
          }
        : null,
      visibility: c.visibility as any,
    };
  });

  return Response.json({ comments: out, viewerFanClubTier }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;

  // Basic anti-spam: respect admin mute/ban on user.
  if (viewerId) {
    const u = await prisma.user.findUnique({ where: { id: viewerId }, select: { bannedAt: true, mutedUntil: true } });
    const now = new Date();
    if (u?.bannedAt) return Response.json({ error: "Account banned" }, { status: 403 });
    if (u?.mutedUntil && u.mutedUntil.getTime() > now.getTime()) {
      return Response.json({ error: "You are muted" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => null);
  const videoId = body?.videoId as string | undefined;
  const content = body?.content as string | undefined;

  if (!videoId || !content) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      status: true,
      access: true,
      interactionsLocked: true,
      authorId: true,
      deletedAt: true,
    },
  });

  if (!video) {
    return Response.json({ error: "Video not found" }, { status: 404 });
  }

  if (!(await canViewVideoDb(video as any, session))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await canInteractWithVideoDb(video as any, session))) {
    return Response.json({ error: "Interactions disabled" }, { status: 403 });
  }

// Keyword filter (per creator): auto-hide comments containing banned keywords.
let visibility: "VISIBLE" | "HIDDEN" = "VISIBLE";
if (video.authorId) {
  const s = await prisma.creatorModerationSetting.findUnique({
    where: { creatorId: video.authorId },
    select: { keywordsCsv: true },
  });
  const kw = (s?.keywordsCsv || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (kw.length) {
    const lower = content.toLowerCase();
    if (kw.some((k) => lower.includes(k.toLowerCase()))) {
      visibility = "HIDDEN";
    }
  }
}

  const c = await prisma.comment.create({
    data: {
      videoId,
      content,
      userId: viewerId ?? null,
      visibility,
      moderatedAt: visibility === "HIDDEN" ? new Date() : null,
    },
    include: { user: { select: { name: true } } },
  });

  if (viewerId) {
    // Task 12: Gamification XP (comment)
    grantXp({
      userId: viewerId,
      sourceKey: `COMMENT:${c.id}`,
      amount: 10,
      badgeKey: "FIRST_COMMENT",
      badgeName: "First Comment",
      badgeDescription: "Bình luận lần đầu",
      badgeIcon: "💬",
      dailyKey: "COMMENT",
      dailyGoal: 3,
      dailyInc: 1,
    }).catch(() => {});
  }


  return Response.json({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    user: c.user ? { name: c.user.name } : null,
    visibility: c.visibility,
  });
}