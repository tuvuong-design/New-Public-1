import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays } from "@/lib/seasonPass";
import { calcCouponDiscountStars, getValidCouponTx, normalizeCouponCode } from "@/lib/coupons";

export const runtime = "nodejs";

const schema = z.object({
  txId: z.string().min(6).max(128).optional(),
  couponCode: z.string().min(1).max(64).optional(),
});

function idemFrom(req: Request, bodyTx?: string) {
  const h = req.headers.get("Idempotency-Key") || req.headers.get("x-idempotency-key");
  const raw = (bodyTx || h || "").trim();
  if (raw) return raw.slice(0, 128);
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const txId = idemFrom(req, body.data.txId);

  try {
    const out = await prisma.$transaction(async (tx) => {
      const existing = await tx.seasonPassPurchase.findFirst({ where: { userId, txId }, select: { id: true, endsAt: true } });
      if (existing) {
        const u = await tx.user.findUnique({ where: { id: userId }, select: { starBalance: true } });
        return { reused: true, endsAt: existing.endsAt, starBalance: u?.starBalance ?? 0 };
      }

      const cfg = await tx.paymentConfig.findUnique({
        where: { id: 1 },
        select: { seasonPassEnabled: true, seasonPassPriceStars: true },
      });
      if (!(cfg?.seasonPassEnabled ?? false)) throw new Error("SEASON_PASS_DISABLED");
      const price = Math.max(1, cfg?.seasonPassPriceStars ?? 300);

      let couponId: string | null = null;
      let couponCode: string | null = null;
      let discountStars = 0;
      if (body.data.couponCode) {
        try {
          couponCode = normalizeCouponCode(body.data.couponCode);
          const coupon = await getValidCouponTx(tx as any, { code: couponCode, userId, appliesTo: "SEASON_PASS" });
          couponId = coupon.id;
          discountStars = calcCouponDiscountStars(coupon as any, price);
        } catch (e: any) {
          throw new Error(e?.message || "COUPON_INVALID");
        }
      }
      discountStars = Math.max(0, Math.min(price - 1, Math.floor(discountStars || 0)));
      const finalPrice = Math.max(1, price - discountStars);

      const me = await tx.user.findUnique({ where: { id: userId }, select: { starBalance: true } });
      if (!me) throw new Error("USER_NOT_FOUND");
      if ((me.starBalance ?? 0) < finalPrice) throw new Error("INSUFFICIENT_STARS");

      const now = new Date();
      const current = await tx.seasonPass.findFirst({ where: { userId }, select: { id: true, endsAt: true, status: true } });
      const base = current && current.status === "ACTIVE" && current.endsAt > now ? current.endsAt : now;
      const endsAt = addDays(base, 30);

      await tx.user.update({ where: { id: userId }, data: { starBalance: { decrement: finalPrice } } });

      const starTx = await tx.starTransaction.create({
        data: {
          userId,
          delta: -finalPrice,
          stars: finalPrice,
          quantity: 1,
          type: "SEASON_PASS_PURCHASE",
          discountReason: "SEASON_PASS_30D",
          note: JSON.stringify({ v: 1, kind: "SEASON_PASS_30D", txId, originalPriceStars: price, discountStars, finalPriceStars: finalPrice, couponCode, couponId, baseEndsAt: base.toISOString(), endsAt: endsAt.toISOString() }),
        },
        select: { id: true },
      });

      await tx.seasonPass.upsert({
        where: { userId },
        create: { userId, startsAt: now, endsAt, status: "ACTIVE" },
        update: { startsAt: now, endsAt, status: "ACTIVE" },
      });

      const purchase = await tx.seasonPassPurchase.create({
        data: {
          userId,
          starsSpent: finalPrice,
          originalPriceStars: price,
          discountStars,
          finalPriceStars: finalPrice,
          couponId: couponId ?? null,
          couponCode: couponCode ?? null,
          startsAt: now,
          endsAt,
          txId,
          starTxId: starTx.id,
        },
        select: { id: true },
      });

      if (couponId) {
        await tx.couponRedemption.create({
          data: { couponId, userId, sourceKind: "SEASON_PASS", sourceId: txId, starsBonus: 0, starsDiscount: discountStars },
        }).catch(() => null);
      }

      const u2 = await tx.user.findUnique({ where: { id: userId }, select: { starBalance: true } });
      return { reused: false, endsAt, starBalance: u2?.starBalance ?? 0 };
    });

    return Response.json({ ok: true, ...out });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "FAILED" }, { status: 400 });
  }
}
