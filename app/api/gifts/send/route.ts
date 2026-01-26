import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { incDailyMetric } from "@/lib/metrics";
import { incBoostStat } from "@/lib/boost";
import { canInteractWithVideoDb, canViewVideoDb } from "@/lib/videoAccessDb";
import { releaseMaturedHoldsTx } from "@/lib/stars/holds";

export const runtime = "nodejs";

const schema = z.object({
  videoId: z.string().min(1),
  giftId: z.string().min(1),
  quantity: z.number().int().min(1).max(99).default(1),
  message: z.string().max(500).optional(),
  anonymous: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const body = schema.parse(await req.json());
  const msg = (body.message ?? "").trim().slice(0, 500);
  const anonymous = Boolean(body.anonymous);
  const content = msg || "Cảm ơn bạn! 💛";

  // Gate: ensure video is viewable + interactions allowed
  const vGate = await prisma.video.findUnique({
    where: { id: body.videoId },
    select: { id: true, status: true, access: true, authorId: true, deletedAt: true, interactionsLocked: true },
  });
  if (!vGate) return Response.json({ ok: false, message: "VIDEO_NOT_FOUND" }, { status: 404 });
  if (!(await canViewVideoDb(vGate as any, session))) return Response.json({ ok: false, message: "FORBIDDEN" }, { status: 403 });
  if (!(await canInteractWithVideoDb(vGate as any, session))) return Response.json({ ok: false, message: "INTERACTIONS_DISABLED" }, { status: 403 });

  const result = await prisma.$transaction(async (tx) => {
    // Opportunistically release matured holds before checking balance.
    await releaseMaturedHoldsTx(tx, userId);

    const [u, gift, v] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { starBalance: true } }),
      tx.gift.findUnique({ where: { id: body.giftId }, select: { id: true, name: true, starsCost: true, active: true, icon: true } }),
      tx.video.findUnique({ where: { id: body.videoId }, select: { id: true, starCount: true, giftCount: true, commentCount: true } }),
    ]);

    if (!u) throw new Error("USER_NOT_FOUND");
    if (!gift || !gift.active) throw new Error("GIFT_NOT_FOUND");
    if (!v) throw new Error("VIDEO_NOT_FOUND");

    const cost = gift.starsCost * body.quantity;
    if (u.starBalance < cost) throw new Error("INSUFFICIENT_STARS");

    await tx.user.update({ where: { id: userId }, data: { starBalance: { decrement: cost } } });

    const v2 = await tx.video.update({
      where: { id: body.videoId },
      data: {
        starCount: { increment: cost },
        giftCount: { increment: body.quantity },
        commentCount: { increment: 1 }, // Super Thanks comment
      },
      select: { starCount: true, giftCount: true, commentCount: true },
    });

    const st = await tx.starTransaction.create({
      data: {
        userId,
        delta: -cost,
        stars: cost,
        quantity: body.quantity,
        type: "GIFT",
        videoId: body.videoId,
        giftId: body.giftId,
        note: JSON.stringify({ v: 1, kind: "SUPERTHANKS", anonymous, giftId: body.giftId, giftName: gift.name, quantity: body.quantity, cost }),
      },
      select: { id: true },
    });

    await tx.comment.create({
      data: {
        videoId: body.videoId,
        userId,
        content,
        isSuperThanks: true,
        superThanksStars: cost,
        superThanksQty: body.quantity,
        giftId: body.giftId,
        starTxId: st.id,
      },
    });

    // Metrics + Boost stats
    await incDailyMetric(tx as any, body.videoId, "stars", cost);
    await incDailyMetric(tx as any, body.videoId, "gifts", body.quantity);
    await incDailyMetric(tx as any, body.videoId, "comments", 1);
    await incBoostStat(tx as any, body.videoId, "statStars", cost);
    await incBoostStat(tx as any, body.videoId, "statGifts", body.quantity);
    await incBoostStat(tx as any, body.videoId, "statComments", 1);

    const u2 = await tx.user.findUnique({ where: { id: userId }, select: { starBalance: true } });
    return { v: v2, u: u2, gift };
  });

  return Response.json({
    ok: true,
    starBalance: result.u?.starBalance ?? 0,
    starCount: result.v.starCount,
    giftCount: result.v.giftCount,
    giftIcon: result.gift.icon ?? "🎁",
    giftName: result.gift.name,
    stars: result.v.starCount,
  });
}
