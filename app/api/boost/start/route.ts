import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getActiveMembershipTier } from "@/lib/membership";
import { getSiteConfig } from "@/lib/siteConfig";
import { releaseMaturedHoldsTx } from "@/lib/stars/holds";

const schema = z.object({
  planId: z.string().min(1),
  videoId: z.string().min(1),
});

function monthKey(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { planId, videoId } = schema.parse(await req.json());

  const [cfg, plan, video, user] = await Promise.all([
    getSiteConfig(),
    prisma.boostPlan.findUnique({ where: { id: planId } }),
    prisma.video.findUnique({ where: { id: videoId } }),
    prisma.user.findUnique({ where: { id: uid }, select: { starBalance: true } }),
  ]);

  if (!plan) return Response.json({ error: "Plan not found" }, { status: 404 });
  if (!video) return Response.json({ error: "Video not found" }, { status: 404 });
  if (video.authorId !== uid) {
    return Response.json({ error: "You can only boost your own videos" }, { status: 403 });
  }
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const tier = getActiveMembershipTier(session.user as any);
  const isPremiumPlus = tier === "PREMIUM_PLUS";
  const freeQuota = Math.max(0, Number(cfg.premiumPlusFreeBoostsPerMonth ?? 0));

  // NOTE: quota enforcement is done inside the transaction to avoid races.
  try {
    const order = await prisma.$transaction(async (tx) => {
      const now = new Date();
      // Opportunistically release matured holds before checking balance.
      await releaseMaturedHoldsTx(tx, uid);

      let chargeStars = plan.priceStars;

      if (isPremiumPlus && freeQuota > 0) {
        const key = monthKey(now);
        const usage = await tx.premiumBenefitUsage.upsert({
          where: { userId_month: { userId: uid, month: key } },
          update: {},
          create: { userId: uid, month: key, freeBoostsUsed: 0 },
          select: { id: true, freeBoostsUsed: true },
        });
        if (usage.freeBoostsUsed < freeQuota) {
          chargeStars = 0;
          await tx.premiumBenefitUsage.update({
            where: { id: usage.id },
            data: { freeBoostsUsed: { increment: 1 } },
          });
        }
      }

      if (chargeStars > 0) {
        const me = await tx.user.findUnique({ where: { id: uid }, select: { starBalance: true } });
        if (!me || (me.starBalance ?? 0) < chargeStars) {
          throw new Error("INSUFFICIENT_STARS");
        }
        await tx.user.update({ where: { id: uid }, data: { starBalance: { decrement: chargeStars } } });
        await tx.starTransaction.create({
          data: {
            userId: uid,
            delta: -chargeStars,
            stars: chargeStars,
            type: "BOOST_PURCHASE",
            note: `Boost plan ${plan.id}`,
          },
        });
      }

      return tx.boostOrder.create({
        data: {
          userId: uid,
          videoId,
          planId,
          status: "ACTIVE",
          startAt: now,
          endAt: new Date(now.getTime() + plan.durationHours * 60 * 60 * 1000),
          priceStars: chargeStars,
          baseViews: video.viewCount,
          baseLikes: video.likeCount,
          baseShares: video.shareCount,
          baseComments: video.commentCount,
          baseStars: video.starCount,
          baseGifts: video.giftCount,
        },
      });
    });

    return Response.json({ ok: true, orderId: order.id, priceStars: order.priceStars });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "INSUFFICIENT_STARS") {
      return Response.json({ error: "Insufficient stars" }, { status: 400 });
    }
    return Response.json({ error: "Failed to start boost" }, { status: 500 });
  }
}
