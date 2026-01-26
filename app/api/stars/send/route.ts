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
  amount: z.number().int().min(1).max(9999),
  message: z.string().max(500).optional(),
  anonymous: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  // @ts-expect-error custom field
  const userId = session?.user?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const body = schema.parse(await req.json());
  const msg = (body.message ?? "").trim().slice(0, 500);
  const anonymous = Boolean(body.anonymous);
  const content = msg || "Cảm ơn bạn! 💛";

  const video = await prisma.video.findUnique({
    where: { id: body.videoId },
    select: {
      id: true,
      status: true,
      access: true,
      interactionsLocked: true,
      authorId: true,
      deletedAt: true,
    },
  });
  if (!video) return Response.json({ ok: false, message: "VIDEO_NOT_FOUND" }, { status: 404 });
  if (!(await canViewVideoDb(video as any, session))) return Response.json({ ok: false, message: "FORBIDDEN" }, { status: 403 });
  if (!(await canInteractWithVideoDb(video as any, session)))
    return Response.json({ ok: false, message: "INTERACTIONS_DISABLED" }, { status: 403 });

  const result = await prisma.$transaction(async (tx) => {
    // Opportunistically release matured holds before checking balance.
    await releaseMaturedHoldsTx(tx, userId);

    const u = await tx.user.findUnique({ where: { id: userId }, select: { starBalance: true } });
    if (!u) throw new Error("USER_NOT_FOUND");
    if (u.starBalance < body.amount) throw new Error("INSUFFICIENT_STARS");

    await tx.user.update({ where: { id: userId }, data: { starBalance: { decrement: body.amount } } });
    const v2 = await tx.video.update({
      where: { id: body.videoId },
      data: { starCount: { increment: body.amount }, commentCount: { increment: 1 } },
      select: { starCount: true },
    });

    const st = await tx.starTransaction.create({
      data: {
        userId,
        delta: -body.amount,
        stars: body.amount,
        quantity: 1,
        type: "STARS",
        videoId: body.videoId,
        note: JSON.stringify({ v: 1, kind: "SUPERTHANKS", anonymous, amount: body.amount, message: msg }),
      },
      select: { id: true },
    });

    await tx.comment.create({
      data: {
        videoId: body.videoId,
        userId,
        content,
        isSuperThanks: true,
        superThanksStars: body.amount,
        superThanksQty: 1,
        starTxId: st.id,
      },
    });

    // Metrics + Boost stats
    await incDailyMetric(tx as any, body.videoId, "stars", body.amount);
    await incDailyMetric(tx as any, body.videoId, "comments", 1);
    await incBoostStat(tx as any, body.videoId, "statStars", body.amount);
    await incBoostStat(tx as any, body.videoId, "statComments", 1);

    const u2 = await tx.user.findUnique({ where: { id: userId }, select: { starBalance: true } });
    return { v: v2, u: u2 };
  });

  return Response.json({ ok: true, starBalance: result.u?.starBalance ?? 0, starCount: result.v.starCount });
}
