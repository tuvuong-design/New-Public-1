import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canInteractWithVideoDb, canViewVideoDb } from "@/lib/videoAccessDb";
import { grantXp } from "@/lib/gamification/grantXp";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const videoId = body.videoId as string;
  if (!videoId) {
    return Response.json({ error: "Missing videoId" }, { status: 400 });
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, status: true, access: true, interactionsLocked: true, authorId: true, deletedAt: true },
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

  const existing = await prisma.like.findUnique({
    where: { userId_videoId: { userId, videoId } },
  });

  if (existing) {
    await prisma.like.delete({
      where: { userId_videoId: { userId, videoId } },
    });
    await prisma.video.update({
      where: { id: videoId },
      data: { likeCount: { decrement: 1 } },
    });
    return Response.json({ liked: false });
  }

  await prisma.like.create({
    data: { userId, videoId },
  });
  await prisma.video.update({
    where: { id: videoId },
    data: { likeCount: { increment: 1 } },
  });
  // Task 12: Gamification XP (idempotent via XpEvent.sourceKey)
  grantXp({
    userId,
    sourceKey: `LIKE:${videoId}`,
    amount: 5,
    badgeKey: "FIRST_LIKE",
    badgeName: "First Like",
    badgeDescription: "Thả tim lần đầu",
    badgeIcon: "❤️",
    dailyKey: "LIKE",
    dailyGoal: 3,
    dailyInc: 1,
  }).catch(() => {});

  return Response.json({ liked: true });
}
