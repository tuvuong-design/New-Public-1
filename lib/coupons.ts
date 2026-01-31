import type { Prisma } from "@prisma/client";

export type CouponAppliesToInput = "TOPUP" | "SEASON_PASS";

export function normalizeCouponCode(raw: string): string {
  const code = (raw || "").trim().toUpperCase();
  if (!code) throw new Error("COUPON_EMPTY");
  if (code.length > 64) throw new Error("COUPON_TOO_LONG");
  // allow A-Z0-9 and separators
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) throw new Error("COUPON_INVALID_FORMAT");
  return code;
}

export async function getValidCouponTx(
  tx: Prisma.TransactionClient,
  opts: { code: string; userId: string; appliesTo: CouponAppliesToInput }
) {
  const code = normalizeCouponCode(opts.code);
  const coupon = await tx.coupon.findUnique({ where: { code } });
  if (!coupon) throw new Error("COUPON_NOT_FOUND");
  if (!coupon.active) throw new Error("COUPON_INACTIVE");

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new Error("COUPON_NOT_STARTED");
  if (coupon.endsAt && coupon.endsAt < now) throw new Error("COUPON_EXPIRED");

  const applies = coupon.appliesTo;
  if (applies !== "ANY" && applies !== opts.appliesTo) throw new Error("COUPON_NOT_APPLICABLE");

  if (coupon.maxRedemptionsTotal != null) {
    const used = await tx.couponRedemption.count({ where: { couponId: coupon.id } });
    if (used >= coupon.maxRedemptionsTotal) throw new Error("COUPON_SOLD_OUT");
  }

  if (coupon.maxRedemptionsPerUser != null) {
    const used = await tx.couponRedemption.count({ where: { couponId: coupon.id, userId: opts.userId } });
    if (used >= coupon.maxRedemptionsPerUser) throw new Error("COUPON_USER_LIMIT");
  }

  return coupon;
}

export function calcCouponBonusStars(coupon: { kind: any; value: number }, baseStars: number): number {
  const v = Number(coupon.value || 0);
  if (!Number.isFinite(v) || v <= 0) return 0;
  if (coupon.kind === "PERCENT") {
    const pct = Math.max(1, Math.min(100, v));
    return Math.floor((baseStars * pct) / 100);
  }
  return Math.max(0, Math.floor(v));
}

export function calcCouponDiscountStars(coupon: { kind: any; value: number }, priceStars: number): number {
  const v = Number(coupon.value || 0);
  if (!Number.isFinite(v) || v <= 0) return 0;
  if (coupon.kind === "PERCENT") {
    const pct = Math.max(1, Math.min(100, v));
    return Math.floor((priceStars * pct) / 100);
  }
  return Math.max(0, Math.floor(v));
}
