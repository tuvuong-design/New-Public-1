import { prisma } from "@/lib/prisma";
import type { StarDeposit } from "@prisma/client";
import { evaluateStarsCreditRisk } from "@/lib/payments/risk";

export async function creditDepositStars(depositId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const dep = await tx.starDeposit.findUnique({ where: { id: depositId }, include: { package: true, user: true } });
    if (!dep) throw new Error("DEPOSIT_NOT_FOUND");
    if (!dep.userId) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "UNMATCHED", failureReason: dep.failureReason || "no-user" } });
      return { ok: false as const, status: "UNMATCHED" };
    }
    if (dep.status === "CREDITED") return { ok: true as const, status: "CREDITED" };

    const existingTx = await tx.starTransaction.findUnique({ where: { depositId: dep.id } });
    if (existingTx) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "CREDITED", creditedAt: dep.creditedAt || new Date() } });
      return { ok: true as const, status: "CREDITED" };
    }

    const stars = dep.package?.stars || 0;
    if (stars <= 0) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "NEEDS_REVIEW", failureReason: "missing-package-stars" } });
      return { ok: false as const, status: "NEEDS_REVIEW" };
    }

    // Anti-fraud: rule-based risk checks (best-effort; requires Redis).
    const risk = await evaluateStarsCreditRisk({ userId: dep.userId, stars, scope: "DEPOSIT" });
    if (!risk.ok) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "NEEDS_REVIEW", failureReason: `risk_${risk.reason}` } });
      await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "RISK_REVIEW", message: `Risk rule triggered: ${risk.reason}` } });
      return { ok: false as const, status: "NEEDS_REVIEW", risk: risk.reason };
    }

    await tx.user.update({ where: { id: dep.userId }, data: { starBalance: { increment: stars } } });
    await tx.starTransaction.create({
      data: {
        userId: dep.userId,
        delta: stars,
        stars,
        type: "TOPUP",
        depositId: dep.id,
        note: `${reason}\nchain=${dep.chain}\nexpected=${dep.expectedAmount?.toString() || ""}\nactual=${dep.actualAmount?.toString() || ""}`,
      },
    });

    await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "CREDITED", creditedAt: new Date() } });
    await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "CREDITED", message: `Credited ${stars} stars` } });

    return { ok: true as const, status: "CREDITED", stars };
  });
}

export async function refundDepositStars(depositId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const dep = await tx.starDeposit.findUnique({ where: { id: depositId }, include: { user: true } });
    if (!dep) throw new Error("DEPOSIT_NOT_FOUND");
    if (!dep.userId) throw new Error("NO_USER");

    const st = await tx.starTransaction.findUnique({ where: { depositId: dep.id } });
    if (!st) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
      await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "REFUND_NO_TX", message: "Refund marked without existing credit tx" } });
      return { ok: true as const, status: "REFUNDED" };
    }

    // refund = deduct stars
    const refundStars = Math.abs(st.delta);
    await tx.user.update({ where: { id: dep.userId }, data: { starBalance: { decrement: refundStars } } });
    await tx.starTransaction.create({
      data: {
        userId: dep.userId,
        delta: -refundStars,
        stars: refundStars,
        type: "REFUND",
        note: `${reason}\nrefOfDeposit=${dep.id}`,
      },
    });

    await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
    await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "REFUNDED", message: `Refunded ${refundStars} stars` } });

    return { ok: true as const, status: "REFUNDED", stars: refundStars };
  });
}
