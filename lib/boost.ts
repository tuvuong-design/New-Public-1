import type { PrismaClient, BoostPlanType } from "@prisma/client";

type BoostField = "statViews" | "statLikes" | "statShares" | "statComments" | "statStars" | "statGifts";

export async function incBoostStat(tx: PrismaClient, videoId: string, field: BoostField, incBy = 1) {
  if (incBy <= 0) return;
  const now = new Date();
  const order = await tx.boostOrder.findFirst({
    where: {
      videoId,
      status: "ACTIVE",
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    },
    orderBy: { startAt: "desc" },
    include: { plan: true },
  });
  if (!order) return;

  const updated = await tx.boostOrder.update({
    where: { id: order.id },
    data: { [field]: { increment: incBy } as any },
    include: { plan: true },
  });

  // Auto-expire for DURATION when time passed
  if (updated.plan.type === ("DURATION" as BoostPlanType) && updated.endAt && updated.endAt <= now) {
    await tx.boostOrder.update({ where: { id: updated.id }, data: { status: "EXPIRED" } });
    return;
  }

  // Auto-expire for TARGET_INTERACTIONS
  if (updated.plan.type === ("TARGET_INTERACTIONS" as BoostPlanType)) {
    const t = updated.plan;
    const ok =
      (t.targetViews == null || updated.statViews >= t.targetViews) &&
      (t.targetLikes == null || updated.statLikes >= t.targetLikes) &&
      (t.targetShares == null || updated.statShares >= t.targetShares) &&
      (t.targetComments == null || updated.statComments >= t.targetComments) &&
      (t.targetStars == null || updated.statStars >= t.targetStars) &&
      (t.targetGifts == null || updated.statGifts >= t.targetGifts);

    if (ok) {
      await tx.boostOrder.update({ where: { id: updated.id }, data: { status: "EXPIRED", endAt: now } });
    }
  }
}

export async function getActiveBoostedVideos(tx: PrismaClient, take = 20) {
  const now = new Date();
  const orders = await tx.boostOrder.findMany({
    where: { status: "ACTIVE", OR: [{ endAt: null }, { endAt: { gt: now } }], video: { status: "PUBLISHED" } },
    orderBy: { startAt: "desc" },
    take,
    include: { video: true, plan: true },
  });
  return orders;
}
