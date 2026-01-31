import { prisma } from "@/lib/prisma";
import type { StarDeposit } from "@prisma/client";
import { evaluateStarsCreditRisk } from "@/lib/payments/risk";
import { calcCouponBonusStars, getValidCouponTx, normalizeCouponCode } from "@/lib/coupons";
import { applyReferralBonusTx } from "@/lib/referrals";
import { sendTelegram } from "@/lib/notify/telegram";

export async function creditDepositStars(depositId: string, reason: string) {
  const result = await prisma.$transaction(async (tx) => {
    const dep = await tx.starDeposit.findUnique({
      where: { id: depositId },
      include: { package: true, user: true, coupon: true },
    });
    if (!dep) throw new Error("DEPOSIT_NOT_FOUND");
    if (!dep.userId) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "UNMATCHED", failureReason: dep.failureReason || "no-user" } });
      return { ok: false as const, status: "UNMATCHED" };
    }
    if (dep.status === "CREDITED") return { ok: true as const, status: "CREDITED" };

    const baseStars = Math.max(0, Math.trunc(Number(dep.package?.stars ?? 0)));
    const bundleBonusStars = Math.max(0, Math.trunc(Number((dep.package as any)?.bonusStars ?? 0)));

    if (baseStars <= 0) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "NEEDS_REVIEW", failureReason: "missing-package-stars" } });
      return { ok: false as const, status: "NEEDS_REVIEW" };
    }

    // Best-effort coupon bonus for TOPUP (bonus stars).
    let couponBonusStars = 0;
    let couponId: string | null = dep.couponId || null;
    let couponCode: string | null = dep.couponCode || null;
    if (couponCode) {
      try {
        couponCode = normalizeCouponCode(couponCode);
        const coupon = await getValidCouponTx(tx as any, {
          code: couponCode,
          userId: dep.userId,
          appliesTo: "TOPUP",
        });
        couponId = coupon.id;
        couponBonusStars = calcCouponBonusStars(coupon as any, baseStars);
      } catch {
        couponBonusStars = 0;
      }
    }

    const totalCredited = baseStars + bundleBonusStars + couponBonusStars;

    // Anti-fraud: rule-based risk checks (best-effort; requires Redis).
    const risk = await evaluateStarsCreditRisk({ userId: dep.userId, stars: totalCredited, scope: "DEPOSIT" });
    if (!risk.ok) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "NEEDS_REVIEW", failureReason: `risk_${risk.reason}` } });
      await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "RISK_REVIEW", message: `Risk rule triggered: ${risk.reason}` } });
      return { ok: false as const, status: "NEEDS_REVIEW", risk: risk.reason };
    }

    // Idempotency per depositId+type (same as worker reconcile).
    const existingTopup = await tx.starTransaction.findUnique({
      where: { depositId_type: { depositId: dep.id, type: "TOPUP" } },
      select: { id: true },
    }).catch(() => null);

    let topupTxId = existingTopup?.id || null;
    if (!topupTxId) {
      await tx.user.update({ where: { id: dep.userId }, data: { starBalance: { increment: baseStars } } });
      const st = await tx.starTransaction.create({
        data: {
          userId: dep.userId,
          delta: baseStars,
          stars: baseStars,
          type: "TOPUP",
          depositId: dep.id,
          note: `${reason}\nchain=${dep.chain}\nexpected=${dep.expectedAmount?.toString() || ""}\nactual=${dep.actualAmount?.toString() || ""}`,
        },
        select: { id: true },
      });
      topupTxId = st.id;
    }

    if (bundleBonusStars > 0) {
      const existing = await tx.starTransaction.findUnique({
        where: { depositId_type: { depositId: dep.id, type: "BUNDLE_BONUS" } },
        select: { id: true },
      }).catch(() => null);
      if (!existing) {
        await tx.user.update({ where: { id: dep.userId }, data: { starBalance: { increment: bundleBonusStars } } });
        await tx.starTransaction.create({
          data: {
            userId: dep.userId,
            delta: bundleBonusStars,
            stars: bundleBonusStars,
            type: "BUNDLE_BONUS",
            depositId: dep.id,
            discountReason: "BUNDLE_BONUS",
            note: JSON.stringify({ v: 1, kind: "BUNDLE_BONUS", depositId: dep.id, baseStars, bundleBonusStars }),
          },
        });
      }
    }

    if (couponBonusStars > 0 && couponId && couponCode) {
      const existing = await tx.starTransaction.findUnique({
        where: { depositId_type: { depositId: dep.id, type: "COUPON_BONUS" } },
        select: { id: true },
      }).catch(() => null);
      if (!existing) {
        // Idempotent redemption (best-effort)
        await tx.couponRedemption
          .create({
            data: {
              couponId,
              userId: dep.userId,
              sourceKind: "TOPUP",
              sourceId: dep.id,
              starsBonus: couponBonusStars,
              starsDiscount: 0,
            },
          })
          .catch(() => null);

        await tx.user.update({ where: { id: dep.userId }, data: { starBalance: { increment: couponBonusStars } } });
        await tx.starTransaction.create({
          data: {
            userId: dep.userId,
            delta: couponBonusStars,
            stars: couponBonusStars,
            type: "COUPON_BONUS",
            depositId: dep.id,
            discountReason: `COUPON:${couponCode}`.slice(0, 60),
            note: JSON.stringify({ v: 1, kind: "COUPON_BONUS", depositId: dep.id, couponId, couponCode, baseStars, couponBonusStars }),
          },
        });
      }
    }

    // Referral (TOPUP) based on total credited (base + bonuses).
    await applyReferralBonusTx(tx as any, {
      referredUserId: dep.userId,
      baseStars: totalCredited,
      sourceKind: "TOPUP",
      sourceId: dep.id,
      baseStarTxId: topupTxId || undefined,
    }).catch(() => null);

    await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "CREDITED", creditedAt: new Date() } });
    await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "CREDITED", message: `Credited ${totalCredited} stars (base=${baseStars}, bundle=${bundleBonusStars}, coupon=${couponBonusStars})` } });

    return { ok: true as const, status: "CREDITED", stars: totalCredited };
  });

  // Notify best-effort (không ảnh hưởng luồng chính)
  if (result?.status === "CREDITED") {
    const stars = (result as any)?.stars ?? "";
    await sendTelegram(`⭐ <b>Nạp sao thành công</b>\nDeposit: <code>${depositId}</code>\nStars: <b>${stars}</b>\nReason: ${reason}`);
  } else if (result?.status === "NEEDS_REVIEW") {
    await sendTelegram(`⚠️ <b>Nạp sao cần kiểm tra</b>\nDeposit: <code>${depositId}</code>\nReason: ${reason}\nFailure: ${(result as any)?.risk ?? (result as any)?.reason ?? ""}`);
  }

  return result;
}


export async function refundDepositStars(depositId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const dep = await tx.starDeposit.findUnique({ where: { id: depositId }, include: { user: true } });
    if (!dep) throw new Error("DEPOSIT_NOT_FOUND");
    if (!dep.userId) throw new Error("NO_USER");

    // Sum credited stars for this deposit across TOPUP/BUNDLE_BONUS/COUPON_BONUS.
    const credited = await tx.starTransaction.findMany({
      where: {
        depositId: dep.id,
        type: { in: ["TOPUP", "BUNDLE_BONUS", "COUPON_BONUS"] as any },
        delta: { gt: 0 },
      },
      select: { id: true, type: true, delta: true },
    });

    const refundStars = credited.reduce((acc, t) => acc + Math.max(0, Number(t.delta) || 0), 0);
    if (refundStars <= 0) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
      await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "REFUND_NO_TX", message: "Refund marked without existing credit tx" } });
      return { ok: true as const, status: "REFUNDED" };
    }

    // refund = deduct stars (best-effort; if user already spent stars this may go negative in strict mode elsewhere)
    await tx.user.update({ where: { id: dep.userId }, data: { starBalance: { decrement: refundStars } } });
    await tx.starTransaction.create({
      data: {
        userId: dep.userId,
        delta: -refundStars,
        stars: refundStars,
        type: "REFUND",
        note: `${reason}\nrefOfDeposit=${dep.id}\ncreditedTx=${credited.map((t) => `${t.type}:${t.id}`).join(",")}`,
      },
    });

    await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
    await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "REFUNDED", message: `Refunded ${refundStars} stars` } });

    return { ok: true as const, status: "REFUNDED", stars: refundStars };
  });
}
