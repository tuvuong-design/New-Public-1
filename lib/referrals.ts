import { prisma } from "@/lib/prisma";

function randomCode(len = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid confusing chars
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function ensureReferralCode(userId: string) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (me?.referralCode) return me.referralCode;

  // Best-effort generate unique code
  for (let i = 0; i < 10; i++) {
    const code = randomCode(10);
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch {
      // collision, retry
    }
  }
  // Fallback: use prefix of userId (still unique-ish)
  const code = ("U" + userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)).toUpperCase().slice(0, 14);
  const updated = await prisma.user.update({ where: { id: userId }, data: { referralCode: code }, select: { referralCode: true } });
  return updated.referralCode!;
}

export async function claimReferralCode(userId: string, codeRaw: string) {
  const code = (codeRaw || "").trim().toUpperCase();
  if (!code) throw new Error("MISSING_CODE");

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, referredById: true } });
  if (!me) throw new Error("USER_NOT_FOUND");
  if (me.referredById) throw new Error("ALREADY_CLAIMED");

  const ref = await prisma.user.findFirst({ where: { referralCode: code }, select: { id: true } });
  if (!ref) throw new Error("CODE_NOT_FOUND");
  if (ref.id === userId) throw new Error("CANNOT_REFER_SELF");

  await prisma.user.update({
    where: { id: userId },
    data: { referredById: ref.id, referredAt: new Date() },
  });

  return { referrerId: ref.id };
}

type Tx = Parameters<typeof prisma.$transaction>[0] extends (arg: infer T) => any ? T : any;

async function getReferralCfgTx(tx: Tx) {
  const row = await tx.paymentConfig.findUnique({
    where: { id: 1 },
    select: {
      referralEnabled: true,
      referralPercent: true,
      referralApplyToTopups: true,
      referralApplyToEarnings: true,
    },
  });
  return {
    enabled: row?.referralEnabled ?? false,
    percent: Math.max(0, Math.min(20, row?.referralPercent ?? 0)),
    applyTopups: row?.referralApplyToTopups ?? true,
    applyEarnings: row?.referralApplyToEarnings ?? true,
  };
}

export async function applyReferralBonusTx(
  tx: Tx,
  args: {
    referredUserId: string;
    baseStars: number;
    sourceKind: "TOPUP" | "EARN";
    sourceId: string;
    baseStarTxId?: string | null;
  },
) {
  const baseStars = Math.floor(args.baseStars || 0);
  if (baseStars <= 0) return null;

  const cfg = await getReferralCfgTx(tx);
  if (!cfg.enabled) return null;
  if (cfg.percent < 1 || cfg.percent > 20) return null;

  if (args.sourceKind === "TOPUP" && !cfg.applyTopups) return null;
  if (args.sourceKind === "EARN" && !cfg.applyEarnings) return null;

  const referred = await tx.user.findUnique({
    where: { id: args.referredUserId },
    select: { id: true, referredById: true },
  });
  const referrerId = referred?.referredById || null;
  if (!referrerId) return null;
  if (referrerId === args.referredUserId) return null;

  const bonusStars = Math.floor((baseStars * cfg.percent) / 100);
  if (bonusStars <= 0) return null;

  // Idempotency
  const exists = await tx.referralBonus.findUnique({
    where: { sourceKind_sourceId: { sourceKind: args.sourceKind as any, sourceId: args.sourceId } },
    select: { id: true },
  });
  if (exists) return null;

  await tx.user.update({ where: { id: referrerId }, data: { starBalance: { increment: bonusStars } } });

  const bonusTx = await tx.starTransaction.create({
    data: {
      userId: referrerId,
      delta: bonusStars,
      stars: bonusStars,
      quantity: 1,
      type: "REFERRAL_BONUS",
      discountReason: `REFERRAL_${cfg.percent}PCT`,
      note: JSON.stringify({
        v: 1,
        kind: "REFERRAL_BONUS",
        percent: cfg.percent,
        baseStars,
        bonusStars,
        sourceKind: args.sourceKind,
        sourceId: args.sourceId,
        referredUserId: args.referredUserId,
      }),
    },
    select: { id: true },
  });

  const row = await tx.referralBonus.create({
    data: {
      referrerId,
      referredUserId: args.referredUserId,
      percent: cfg.percent,
      baseStars,
      bonusStars,
      sourceKind: args.sourceKind as any,
      sourceId: args.sourceId,
      baseStarTxId: args.baseStarTxId ?? null,
      bonusStarTxId: bonusTx.id,
    },
    select: { id: true },
  });

  return row;
}
