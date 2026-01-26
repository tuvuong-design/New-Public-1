import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  planId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

// Join a creator's Fan Club membership plan using Stars.
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  if (!viewerId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const creatorId = ctx.params.id;
  const body = bodySchema.parse(await req.json());
  const idem = (body.idempotencyKey ?? `join:${body.planId}:${new Date().toISOString().slice(0, 10)}`) as string;

  if (viewerId === creatorId) {
    return Response.json({ ok: false, message: "CANNOT_JOIN_SELF" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingPurchase = await tx.creatorMembershipPurchase.findUnique({
      where: { userId_idempotencyKey: { userId: viewerId, idempotencyKey: idem } },
      select: { id: true, planId: true, stars: true },
    });
    if (existingPurchase) {
      const m = await tx.creatorMembership.findFirst({ where: { userId: viewerId, creatorId }, select: { id: true, expiresAt: true, status: true } });
      return { ok: true as const, already: true as const, stars: existingPurchase.stars, membership: m };
    }

    const plan = await tx.creatorMembershipPlan.findFirst({
      where: { id: body.planId, userId: creatorId, isActive: true },
      select: { id: true, starsPrice: true, durationDays: true, title: true, tier: true },
    });
    if (!plan) throw new Error("PLAN_NOT_FOUND");

    const u = await tx.user.findUnique({ where: { id: viewerId }, select: { starBalance: true } });
    if (!u) throw new Error("USER_NOT_FOUND");
    if ((u.starBalance ?? 0) < plan.starsPrice) throw new Error("INSUFFICIENT_STARS");

    // Charge Stars
    await tx.user.update({ where: { id: viewerId }, data: { starBalance: { decrement: plan.starsPrice } } });
    const st = await tx.starTransaction.create({
      data: {
        userId: viewerId,
        delta: -plan.starsPrice,
        stars: plan.starsPrice,
        type: "CREATOR_MEMBERSHIP_PURCHASE",
        note: `creator_membership_join\ncreatorId=${creatorId}\nplanId=${plan.id}\ntier=${plan.tier}\nidem=${idem}`,
      },
    });

    const now = new Date();
    const extensionMs = (plan.durationDays || 30) * 24 * 60 * 60 * 1000;
    const existing = await tx.creatorMembership.findFirst({ where: { planId: plan.id, userId: viewerId } });

    let membership;
    if (existing && existing.expiresAt > now && existing.status === "ACTIVE") {
      membership = await tx.creatorMembership.update({
        where: { id: existing.id },
        data: { expiresAt: new Date(existing.expiresAt.getTime() + extensionMs), cancelAtPeriodEnd: false, status: "ACTIVE" },
        select: { id: true, expiresAt: true, status: true },
      });
    } else if (existing) {
      membership = await tx.creatorMembership.update({
        where: { id: existing.id },
        data: { startsAt: now, expiresAt: new Date(now.getTime() + extensionMs), cancelAtPeriodEnd: false, status: "ACTIVE" },
        select: { id: true, expiresAt: true, status: true },
      });
    } else {
      membership = await tx.creatorMembership.create({
        data: { planId: plan.id, userId: viewerId, creatorId, expiresAt: new Date(now.getTime() + extensionMs) },
        select: { id: true, expiresAt: true, status: true },
      });
    }

    await tx.creatorMembershipPurchase.create({
      data: {
        userId: viewerId,
        planId: plan.id,
        creatorId,
        stars: plan.starsPrice,
        starTxId: st.id,
        idempotencyKey: idem,
      },
    });

    return { ok: true as const, already: false as const, stars: plan.starsPrice, membership };
  });

  return Response.json(result);
}
