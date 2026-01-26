import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import BoostClient from "./ui/BoostClient";

export const dynamic = "force-dynamic";

export default async function BoostPage() {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;

  if (!uid) {
    return (
      <div className="card">
        <div style={{ fontWeight: 800 }}>Boost video</div>
        <div className="muted small" style={{ marginTop: 6 }}>
          Bạn cần đăng nhập để boost video.
        </div>
      </div>
    );
  }

  const [user, videos, orders, plans] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { starBalance: true } }),
    prisma.video.findMany({
      where: { authorId: uid, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        thumbKey: true,
        viewCount: true,
        likeCount: true,
        shareCount: true,
        commentCount: true,
        starCount: true,
        giftCount: true,
        createdAt: true,
      },
    }),
    prisma.boostOrder.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { plan: true, video: { select: { title: true } } },
    }),
    prisma.boostPlan.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { priceStars: "asc" }] }),
  ]);

  // Ensure props are serializable (Next.js Server → Client boundary).
  return (
    <BoostClient
      starBalance={user?.starBalance ?? 0}
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        priceStars: p.priceStars,
        durationDays: p.durationDays,
      }))}
      videos={videos.map((v) => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
      }))}
      orders={orders.map((o) => ({
        id: o.id,
        status: o.status,
        videoId: o.videoId,
        videoTitle: o.video.title,
        planName: o.plan.name,
        priceStars: o.priceStars,
        startAt: o.startAt.toISOString(),
        endAt: o.endAt ? o.endAt.toISOString() : null,
        statViews: o.statViews,
        statLikes: o.statLikes,
        statShares: o.statShares,
        statComments: o.statComments,
        statStars: o.statStars,
        statGifts: o.statGifts,
      }))}
    />
  );
}
