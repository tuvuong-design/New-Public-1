import { prisma } from "@/lib/prisma";
import { levelFromXp } from "@/lib/gamification/levels";

export type GrantXpInput = {
  userId: string;
  sourceKey: string;
  amount: number;
  meta?: Record<string, any>;
  badgeKey?: string;
  badgeName?: string;
  badgeDescription?: string;
  badgeIcon?: string;
  dailyKey?: string;
  dailyGoal?: number;
  dailyInc?: number;
};

function dayStartUtc(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function ensureBadgeTx(tx: any, args: { key: string; name?: string; description?: string; icon?: string }) {
  const key = args.key;
  const name = args.name ?? key;
  const description = args.description ?? null;
  const icon = args.icon ?? null;

  const badge = await tx.badge.upsert({
    where: { key },
    update: { name, description, icon },
    create: { key, name, description, icon },
  });

  return badge;
}

async function awardBadgeTx(tx: any, userId: string, badgeKey: string, meta?: { name?: string; description?: string; icon?: string }) {
  const badge = await ensureBadgeTx(tx, { key: badgeKey, name: meta?.name, description: meta?.description, icon: meta?.icon });
  await tx.userBadge.upsert({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
    update: {},
    create: { userId, badgeId: badge.id },
  });
}

async function recordDailyTaskTx(
  tx: any,
  userId: string,
  key: string,
  inc: number,
  goal: number
) {
  const day = dayStartUtc(new Date());
  const safeGoal = Math.max(1, Math.floor(goal || 1));
  const safeInc = Math.max(0, Math.floor(inc || 0));

  const row = await tx.dailyTaskProgress.upsert({
    where: { userId_day_key: { userId, day, key } },
    update: { progress: { increment: safeInc } },
    create: { userId, day, key, progress: safeInc, goal: safeGoal, done: false },
  });

  const done = row.progress >= safeGoal;
  if (done && !row.done) {
    await tx.dailyTaskProgress.update({ where: { id: row.id }, data: { done: true } });
  }
}

export async function grantXp(input: GrantXpInput) {
  const userId = input.userId;
  const sourceKey = String(input.sourceKey || "").slice(0, 200);
  const amount = Math.max(0, Math.floor(input.amount || 0));
  if (!userId || !sourceKey || amount <= 0) return { ok: true, granted: false, xp: 0, level: 1 };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.xpEvent.findUnique({
      where: { userId_sourceKey: { userId, sourceKey } },
      select: { id: true },
    });

    if (existing) {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { xp: true, level: true } });
      return { ok: true, granted: false, xp: user?.xp ?? 0, level: user?.level ?? 1 };
    }

    await tx.xpEvent.create({
      data: {
        userId,
        sourceKey,
        amount,
        metaJson: input.meta ? JSON.stringify(input.meta) : null,
      },
    });

    const updated = await tx.user.update({
      where: { id: userId },
      data: { xp: { increment: amount } },
      select: { xp: true, level: true },
    });

    const newLevel = levelFromXp(updated.xp);
    if (newLevel !== updated.level) {
      await tx.user.update({ where: { id: userId }, data: { level: newLevel } });
      // milestone badges
      if (newLevel >= 5) await awardBadgeTx(tx, userId, "LEVEL_5", { name: "Level 5", description: "Đạt level 5" });
      if (newLevel >= 10) await awardBadgeTx(tx, userId, "LEVEL_10", { name: "Level 10", description: "Đạt level 10" });
    }

    if (input.badgeKey) {
      await awardBadgeTx(tx, userId, input.badgeKey, {
        name: input.badgeName,
        description: input.badgeDescription,
        icon: input.badgeIcon,
      });
    }

    if (input.dailyKey) {
      await recordDailyTaskTx(tx, userId, input.dailyKey, input.dailyInc ?? 1, input.dailyGoal ?? 1);
    }

    return { ok: true, granted: true, xp: updated.xp + 0, level: newLevel };
  });
}
