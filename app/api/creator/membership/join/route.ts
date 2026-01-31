import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { releaseMaturedHoldsTx } from "@/lib/stars/holds";
import { applyReferralBonusTx } from "@/lib/referrals";

export const runtime = "nodejs";

const schema = z.object({
  planId: z.string().min(1),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

function idemFrom(req: Request, bodyIdem?: string) {
  const h = req.headers.get("Idempotency-Key") || req.headers.get("x-idempotency-key");
  const raw = (bodyIdem || h || "").trim();
  if (raw) return raw.slice(0, 128);
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const body = schema.parse(await req.json());
  const idempotencyKey = idemFrom(req, body.idempotencyKey);

  const out = await prisma.$transaction(async (tx) => {
    const existing = await tx.creatorMembershipPurchase.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      select: { id: true, planId: true },
    });
    if (existing) {
      const membership = await tx.creatorMembership.findUnique({
        where: { planId_userId: { planId: existing.planId, userId } },
      });
      return { ok: true, reused: true, membership };
    }

    const plan = await tx.creatorMembershipPlan.findUnique({ where: { id: body.planId } });
    if (!plan || !plan.isActive) throw new Error("PLAN_NOT_FOUND");
    if (plan.userId === userId) throw new Error("FORBIDDEN");

    await releaseMaturedHoldsTx(tx as any, userId);

    const [me, creator] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { id: true, starBalance: true } }),
      tx.user.findUnique({ where: { id: plan.userId }, select: { id: true, starBalance: true } }),
    ]);
    if (!me || !creator) throw new Error("USER_NOT_FOUND");
    if (me.starBalance < plan.starsPrice) throw new Error("INSUFFICIENT_STARS");

    await tx.user.update({ where: { id: userId }, data: { starBalance: { decrement: plan.starsPrice } } });
    await tx.user.update({ where: { id: plan.userId }, data: { starBalance: { increment: plan.starsPrice } } });

    const debitTx = await tx.starTransaction.create({
      data: { userId, delta: -plan.starsPrice, type: "CREATOR_MEMBERSHIP_PURCHASE", stars: plan.starsPrice, note: `Join creator membership: ${plan.id}` },
      select: { id: true },
    });
    const creatorIncomeTx = await tx.starTransaction.create({
      data: { userId: plan.userId, delta: plan.starsPrice, type: "CREATOR_MEMBERSHIP_PURCHASE", stars: plan.starsPrice, note: `Creator membership income: ${plan.id}` },
      select: { id: true },
    });

    await applyReferralBonusTx(tx as any, {
      referredUserId: plan.userId,
      baseStars: plan.starsPrice,
      sourceKind: "EARN",
      sourceId: creatorIncomeTx.id,
      baseStarTxId: creatorIncomeTx.id,
    });

    const now = new Date();
    const current = await tx.creatorMembership.findUnique({ where: { planId_userId: { planId: plan.id, userId } } });
    const base = current && current.expiresAt > now ? current.expiresAt : now;
    const expiresAt = addDays(base, plan.durationDays);

    const membership = await tx.creatorMembership.upsert({
      where: { planId_userId: { planId: plan.id, userId } },
      create: { planId: plan.id, userId, creatorId: plan.userId, expiresAt },
      update: { expiresAt },
    });

    await tx.creatorMembershipPurchase.create({
      data: { userId, planId: plan.id, creatorId: plan.userId, stars: plan.starsPrice, starTxId: debitTx.id, idempotencyKey },
    });

    // Notify creator if enabled
    const ns = await tx.notificationSetting.findUnique({ where: { userId: plan.userId }, select: { disabledTypesCsv: true } });
    const disabled = new Set((ns?.disabledTypesCsv || "").split(",").map((x) => x.trim()).filter(Boolean));
    if (!disabled.has("CREATOR_MEMBERSHIP")) {
      await tx.notification.create({
        data: {
          userId: plan.userId,
          type: "CREATOR_MEMBERSHIP",
          actorId: userId,
          title: "Có người join Fan Club",
          body: `Bạn nhận ${plan.starsPrice}⭐ từ gói: ${plan.title}`,
          url: `/studio/membership`,
          dataJson: JSON.stringify({ planId: plan.id, memberId: userId }),
        },
      });
    }

    return { ok: true, reused: false, membership };
  });

  return Response.json(out);
}
