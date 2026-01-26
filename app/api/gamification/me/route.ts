import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextLevelXp } from "@/lib/gamification/levels";

export const runtime = "nodejs";

function dayStartUtc(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [user, badges, todayTasks] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, xp: true, level: true } }),
    prisma.userBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
      take: 50,
      include: { badge: { select: { key: true, name: true, description: true, icon: true } } },
    }),
    prisma.dailyTaskProgress.findMany({
      where: { userId, day: dayStartUtc(new Date()) },
      orderBy: { key: "asc" },
      take: 50,
      select: { key: true, progress: true, goal: true, done: true, updatedAt: true },
    }),
  ]);

  if (!user) {
    return Response.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      xp: user.xp,
      level: user.level,
      nextLevelXp: nextLevelXp(user.level),
    },
    badges: badges.map((b) => ({
      key: b.badge.key,
      name: b.badge.name,
      description: b.badge.description,
      icon: b.badge.icon,
      earnedAt: b.earnedAt.toISOString(),
    })),
    dailyTasks: todayTasks.map((t) => ({
      key: t.key,
      progress: t.progress,
      goal: t.goal,
      done: t.done,
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}
