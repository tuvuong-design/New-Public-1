import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { grantXp } from "@/lib/gamification/grantXp";

export const runtime = "nodejs";


export async function GET(req: Request) {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!uid) return new Response("UNAUTHORIZED", { status: 401 });

  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId");
  if (!videoId) return new Response("videoId required", { status: 400 });

  const row = await prisma.videoProgress.findUnique({
    where: { userId_videoId: { userId: uid, videoId } },
    select: { seconds: true, updatedAt: true },
  });

  return Response.json({
    videoId,
    seconds: row?.seconds ?? 0,
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!uid) return new Response("UNAUTHORIZED", { status: 401 });

  const { videoId, seconds } = await req.json().catch(() => ({}));
  if (!videoId) return new Response("videoId required", { status: 400 });

  const s = Math.max(0, Math.min(60 * 60 * 24, Number(seconds || 0)));

  // Task 12: Grant XP on first 60s watched (idempotent key)
  const prev = await prisma.videoProgress.findUnique({
    where: { userId_videoId: { userId: uid, videoId } },
    select: { seconds: true },
  });

  await prisma.videoProgress.upsert({
    where: { userId_videoId: { userId: uid, videoId } },
    update: { seconds: s },
    create: { userId: uid, videoId, seconds: s },
  });

  if ((prev?.seconds ?? 0) < 60 && s >= 60) {
    grantXp({
      userId: uid,
      sourceKey: `WATCH60:${videoId}`,
      amount: 5,
      badgeKey: "FIRST_WATCH_60",
      badgeName: "First Watch", 
      badgeDescription: "Xem đủ 60s lần đầu",
      badgeIcon: "▶️",
      dailyKey: "WATCH",
      dailyGoal: 5,
      dailyInc: 1,
    }).catch(() => {});
  }

  return Response.json({ ok: true });
}
