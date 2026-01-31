import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { releaseMaturedHoldsTx } from "@/lib/stars/holds";
import { queues } from "@/lib/queues";
import { grantXp } from "@/lib/gamification/grantXp";
import { applyReferralBonusTx } from "@/lib/referrals";

export const runtime = "nodejs";

const schema = z.object({
  toUserId: z.string().min(1),
  stars: z.number().int().min(1).max(9999),
  message: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

function idemFrom(req: Request, bodyIdem?: string) {
  const h = req.headers.get("Idempotency-Key") || req.headers.get("x-idempotency-key");
  const raw = (bodyIdem || h || "").trim();
  if (raw) return raw.slice(0, 128);
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request) {
  const session = await auth();
  const fromUserId = (session?.user as any)?.id as string | undefined;
  if (!fromUserId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const body = schema.parse(await req.json());
  if (body.toUserId === fromUserId) {
    return Response.json({ ok: false, message: "CANNOT_TIP_SELF" }, { status: 400 });
  }

  const idempotencyKey = idemFrom(req, body.idempotencyKey);
  const msg = (body.message ?? "").trim().slice(0, 500);

  const out = await prisma.$transaction(async (tx) => {
    const existing = await tx.creatorTip.findFirst({
      where: { fromUserId, idempotencyKey },
      select: { id: true, stars: true, toUserId: true },
    });
    if (existing) return { existing: true as const, tipId: existing.id, stars: existing.stars, toUserId: existing.toUserId };

    await releaseMaturedHoldsTx(tx as any, fromUserId);

    const [from, to] = await Promise.all([
      tx.user.findUnique({ where: { id: fromUserId }, select: { id: true, starBalance: true, name: true } }),
      tx.user.findUnique({ where: { id: body.toUserId }, select: { id: true, starBalance: true, name: true } }),
    ]);
    if (!from || !to) throw new Error("USER_NOT_FOUND");
    if (from.starBalance < body.stars) throw new Error("INSUFFICIENT_STARS");

    await tx.user.update({ where: { id: fromUserId }, data: { starBalance: { decrement: body.stars } } });
    await tx.user.update({ where: { id: body.toUserId }, data: { starBalance: { increment: body.stars } } });

    const senderTx = await tx.starTransaction.create({
      data: {
        userId: fromUserId,
        delta: -body.stars,
        stars: body.stars,
        quantity: 1,
        type: "CREATOR_TIP",
        note: JSON.stringify({ v: 1, kind: "CREATOR_TIP", toUserId: body.toUserId, message: msg }),
      },
      select: { id: true },
    });

    const receiverTx = await tx.starTransaction.create({
      data: {
        userId: body.toUserId,
        delta: body.stars,
        stars: body.stars,
        quantity: 1,
        type: "CREATOR_TIP",
        note: JSON.stringify({ v: 1, kind: "CREATOR_TIP_IN", fromUserId, message: msg }),
      },
      select: { id: true },
    });

    await applyReferralBonusTx(tx as any, {
      referredUserId: body.toUserId,
      baseStars: body.stars,
      sourceKind: "EARN",
      sourceId: receiverTx.id,
      baseStarTxId: receiverTx.id,
    });

    const tip = await tx.creatorTip.create({
      data: {
        fromUserId,
        toUserId: body.toUserId,
        stars: body.stars,
        message: msg || null,
        starTxId: senderTx.id,
        idempotencyKey,
      },
      select: { id: true },
    });

    // Notification for receiver
    // Respect receiver notification settings (best-effort).
    const ns = await tx.notificationSetting.findUnique({
      where: { userId: body.toUserId },
      select: { disabledTypesCsv: true },
    });
    const disabled = new Set(
      (ns?.disabledTypesCsv || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    );
    if (!disabled.has("CREATOR_TIP")) {
      await tx.notification.create({
      data: {
        userId: body.toUserId,
        type: "CREATOR_TIP",
        title: "Bạn nhận được tip",
        body: `${from?.name ?? "Ai đó"} đã tip ⭐ ${body.stars}`,
        url: `/studio/revenue`,
        dataJson: JSON.stringify({ tipId: tip.id, fromUserId, stars: body.stars }),
      },
    });

    // Creator webhook outbox (deliveries) for receiver
    const endpoints = await tx.creatorWebhookEndpoint.findMany({
      where: { userId: body.toUserId, enabled: true },
      select: { id: true, eventsCsv: true },
    });
    const interested = endpoints.filter((e) => (e.eventsCsv || "").split(",").map((x) => x.trim()).filter(Boolean).includes("TIP_RECEIVED"));
    const deliveries = interested.length
      ? await tx.creatorWebhookDelivery.createMany({
          data: interested.map((e) => ({
            endpointId: e.id,
            userId: body.toUserId,
            eventType: "TIP_RECEIVED",
            payloadJson: JSON.stringify({
              type: "TIP_RECEIVED",
              tip: { id: tip.id, fromUserId, toUserId: body.toUserId, stars: body.stars, message: msg || null },
              createdAt: new Date().toISOString(),
            }),
            status: "PENDING",
            attempt: 0,
            nextAttemptAt: new Date(),
          })),
          skipDuplicates: false,
        })
      : null;

    const toBalance = await tx.user.findUnique({ where: { id: body.toUserId }, select: { starBalance: true } });
    }
    const fromBalance = await tx.user.findUnique({ where: { id: fromUserId }, select: { starBalance: true } });
    return {
      existing: false as const,
      tipId: tip.id,
      fromBalance: fromBalance?.starBalance ?? 0,
      toBalance: toBalance?.starBalance ?? 0,
      deliveriesCreated: deliveries?.count ?? 0,
    };
  });

  // Kick webhook delivery scan (best-effort)
  if (!out.existing) {
    queues.creatorWebhooks
      ?.add("deliver_pending", {}, { removeOnComplete: true, removeOnFail: 100 })
      .catch(() => {});
  }
  // Task 12: Gamification XP for tipping (idempotent via tipId)
  if (!out.existing) {
    grantXp({
      userId: fromUserId,
      sourceKey: `TIP:${out.tipId}`,
      amount: Math.min(50, body.stars),
      badgeKey: "FIRST_TIP",
      badgeName: "First Tip",
      badgeDescription: "Tip creator lần đầu",
      badgeIcon: "⭐",
      dailyKey: "TIP",
      dailyGoal: 1,
      dailyInc: 1,
    }).catch(() => {});
  }


  return Response.json({ ok: true, ...out });
}
