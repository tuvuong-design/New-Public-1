import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyReferralBonusTx } from "@/lib/referrals";

/**
 * Release all matured StarHold records (status=HELD, releaseAt <= now).
 *
 * We keep this lightweight and callable from web requests to avoid adding new
 * queue/cron contracts. Any user action that touches stars can opportunistically
 * unlock matured holds.
 */

export async function releaseMaturedHolds(userId: string, now: Date = new Date()) {
  return prisma.$transaction((tx) => releaseMaturedHoldsTx(tx, userId, now));
}

export async function releaseMaturedHoldsTx(tx: Prisma.TransactionClient, userId: string, now: Date = new Date()) {
  const holds = await tx.starHold.findMany({
    where: {
      userId,
      status: "HELD",
      releaseAt: { lte: now },
    },
    select: { id: true, amountStars: true, reason: true, refType: true, refId: true },
  });

  if (holds.length === 0) {
    return { released: 0, releasedStars: 0 };
  }

  let total = 0;
  for (const h of holds) total += Number(h.amountStars) || 0;

  // Mark holds as released.
  await tx.starHold.updateMany({
    where: { id: { in: holds.map((h) => h.id) }, status: "HELD" },
    data: { status: "RELEASED" },
  });

  // Add back available stars.
  await tx.user.update({ where: { id: userId }, data: { starBalance: { increment: total } } });

  // Add one StarTransaction per released hold for audit clarity.
  for (const h of holds) {
    const amt = Number(h.amountStars) || 0;
    if (amt <= 0) continue;
    const st = await tx.starTransaction.create({
      data: {
        userId,
        type: "HOLD_RELEASE",
        delta: amt,
        stars: amt,
        quantity: 1,
        note: `Release hold ${h.id}
reason=${h.reason}
ref=${h.refType || ""}:${h.refId || ""}`,
      },
      select: { id: true },
    });

    if (h.reason === "NFT_FIRST_UNVERIFIED_SALE_HOLD") {
      await applyReferralBonusTx(tx as any, {
        referredUserId: userId,
        baseStars: amt,
        sourceKind: "EARN",
        sourceId: st.id,
        baseStarTxId: st.id,
      });
    }
  }

  return { released: holds.length, releasedStars: total };
}

/**
 * Create an escrow-like hold by decrementing user's available starBalance.
 *
 * IMPORTANT: this is used for NFT auction bids and for delayed proceeds holds.
 */
export async function createHoldTx(tx: Prisma.TransactionClient, args: {
  userId: string;
  amountStars: number;
  reason: string;
  refType?: string;
  refId?: string;
  releaseAt?: Date | null;
  txTypeForAudit?: "NFT_SALE" | "NFT_EXPORT" | "STARS";
  note?: string;
}) {
  const amount = Math.max(0, Math.trunc(Number(args.amountStars) || 0));
  if (amount <= 0) throw new Error("INVALID_HOLD_AMOUNT");

  const u = await tx.user.findUnique({ where: { id: args.userId }, select: { id: true, starBalance: true } });
  if (!u) throw new Error("USER_NOT_FOUND");
  if ((u.starBalance ?? 0) < amount) throw new Error("INSUFFICIENT_STARS");

  await tx.user.update({ where: { id: args.userId }, data: { starBalance: { decrement: amount } } });

  const hold = await tx.starHold.create({
    data: {
      userId: args.userId,
      amountStars: amount,
      status: "HELD",
      reason: args.reason,
      refType: args.refType,
      refId: args.refId,
      releaseAt: args.releaseAt ?? null,
    },
    select: { id: true },
  });

  await tx.starTransaction.create({
    data: {
      userId: args.userId,
      type: args.txTypeForAudit ?? "NFT_SALE",
      delta: -amount,
      stars: amount,
      quantity: 1,
      note: args.note || `Hold ${amount} stars (hold=${hold.id}) reason=${args.reason} ref=${args.refType || ""}:${args.refId || ""}`,
    },
  });

  return hold;
}

/**
 * Release a specific hold immediately (used for outbid / cancelled auctions / failed reserves).
 */
export async function releaseHoldNowTx(tx: Prisma.TransactionClient, holdId: string, note?: string) {
  const hold = await tx.starHold.findUnique({
    where: { id: holdId },
    select: { id: true, userId: true, amountStars: true, status: true, reason: true, refType: true, refId: true },
  });
  if (!hold) return { ok: true, released: false };
  if (hold.status !== "HELD") return { ok: true, released: false };
  const amt = Math.max(0, Math.trunc(Number(hold.amountStars) || 0));
  if (amt <= 0) {
    await tx.starHold.update({ where: { id: hold.id }, data: { status: "RELEASED" } });
    return { ok: true, released: true };
  }

  // Mark released first to avoid double-release.
  const updated = await tx.starHold.updateMany({ where: { id: hold.id, status: "HELD" }, data: { status: "RELEASED" } });
  if (updated.count !== 1) return { ok: true, released: false };

  await tx.user.update({ where: { id: hold.userId }, data: { starBalance: { increment: amt } } });
  await tx.starTransaction.create({
    data: {
      userId: hold.userId,
      type: "HOLD_RELEASE",
      delta: amt,
      stars: amt,
      quantity: 1,
      note: note || `Release hold ${hold.id} (${amt} stars) reason=${hold.reason} ref=${hold.refType || ""}:${hold.refId || ""}`,
    },
  });

  return { ok: true, released: true };
}