import type { Prisma } from "@prisma/client";

export async function applyReferralBonusTx(
  tx: Prisma.TransactionClient,
  args: {
    referredUserId: string;
    baseStars: number;
    sourceKind: "TOPUP" | "EARN";
    sourceId: string;
    baseStarTxId?: string;
  }
) {
  const baseStars = Math.max(0, Math.floor(Number(args.baseStars) || 0));
  if (baseStars <= 0) return { applied: false as const, reason: "NO_BASE" };

  const cfg = await tx.paymentConfig.findUnique({
    where: { id: 1 },
    select: {
      referralEnabled: true,
      referralPercent: true,
      referralApplyToTopups: true,
      referralApplyToEarnings: true,
    },
  });

  if (!cfg?.referralEnabled) return { applied: false as const, reason: "DISABLED" };

  const pct = Math.max(0, Math.min(20, Math.floor(Number(cfg.referralPercent) || 0)));
  if (pct <= 0) return { applied: false as const, reason: "PCT_ZERO" };

  if (args.sourceKind === "TOPUP" && !cfg.referralApplyToTopups) return { applied: false as const, reason: "TOPUP_OFF" };
  if (args.sourceKind === "EARN" && !cfg.referralApplyToEarnings) return { applied: false as const, reason: "EARN_OFF" };

  const referred = await tx.user.findUnique({ where: { id: args.referredUserId }, select: { referredById: true } });
  const referrerId = referred?.referredById || null;
  if (!referrerId) return { applied: false as const, reason: "NO_REFERRER" };

  const bonusStars = Math.floor((baseStars * pct) / 100);
  if (bonusStars <= 0) return { applied: false as const, reason: "BONUS_ZERO" };

  // Idempotency: unique (sourceKind, sourceId)
  const existing = await tx.referralBonus.findUnique({
    where: { sourceKind_sourceId: { sourceKind: args.sourceKind as any, sourceId: args.sourceId } },
    select: { id: true, bonusStarTxId: true, bonusStars: true },
  });
  if (existing?.bonusStarTxId) return { applied: true as const, reused: true as const, bonusStars: existing.bonusStars };

  const rb = existing
    ? await tx.referralBonus.update({
        where: { id: existing.id },
        data: {
          referrerId,
          referredUserId: args.referredUserId,
          baseStars,
          bonusStars,
          percent: pct,
          baseStarTxId: args.baseStarTxId ?? null,
        },
        select: { id: true },
      })
    : await tx.referralBonus.create({
        data: {
          referrerId,
          referredUserId: args.referredUserId,
          baseStars,
          bonusStars,
          percent: pct,
          sourceKind: args.sourceKind as any,
          sourceId: args.sourceId,
          baseStarTxId: args.baseStarTxId ?? null,
        },
        select: { id: true },
      });

  await tx.user.update({ where: { id: referrerId }, data: { starBalance: { increment: bonusStars } } });

  const bonusTx = await tx.starTransaction.create({
    data: {
      userId: referrerId,
      type: "REFERRAL_BONUS",
      delta: bonusStars,
      stars: bonusStars,
      quantity: 1,
      note: JSON.stringify({ v: 1, kind: "REFERRAL_BONUS", pct, baseStars, sourceKind: args.sourceKind, sourceId: args.sourceId, referredUserId: args.referredUserId }),
    },
    select: { id: true },
  });

  await tx.referralBonus.update({ where: { id: rb.id }, data: { bonusStarTxId: bonusTx.id } });

  return { applied: true as const, reused: false as const, bonusStars };
}
