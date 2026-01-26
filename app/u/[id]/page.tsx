import TikTokVerticalFeed from "@/components/tiktok/TikTokVerticalFeed";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { getSensitiveModeForUser, shouldHideSensitiveInListings } from "@/lib/sensitive";
import { getActiveMembershipTier } from "@/lib/membership";

export const dynamic = "force-dynamic";

export default async function UserVideosPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  const isSelf = viewerId === id;

  const sensitiveMode = await getSensitiveModeForUser(viewerId ?? null);
  const hideSensitive = shouldHideSensitiveInListings(sensitiveMode);

  const viewerMem = {
    membershipTier: ((session?.user as any)?.membershipTier ?? "NONE") as any,
    membershipExpiresAt: (session?.user as any)?.membershipExpiresAt ? new Date(((session?.user as any).membershipExpiresAt) as any) : null,
  };
  const activeTier = getActiveMembershipTier(viewerMem);
  const allowAccess = activeTier === "PREMIUM_PLUS" ? ({ in: ["PUBLIC", "PREMIUM_PLUS"] } as const) : ("PUBLIC" as const);

  const videos = await prisma.video.findMany({
    where: {
      authorId: id,
      status: { in: isSelf || isAdmin ? ["PUBLISHED", "HIDDEN"] : ["PUBLISHED"] },
      ...(isSelf || isAdmin ? {} : { access: allowAccess }),
      ...(hideSensitive ? { isSensitive: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      isSensitive: true,
      masterM3u8Key: true,
      thumbKey: true,
      storyboardKey: true,
      storyboardFrameW: true,
      storyboardFrameH: true,
      storyboardCols: true,
      storyboardRows: true,
      storyboardCount: true,
    },
  });

  const items = videos.map((v) => ({
    kind: "video" as const,
    id: v.id,
    title: v.title,
    hlsUrl: resolveMediaUrl(v.masterM3u8Key) ?? "",
    posterUrl: resolveMediaUrl(v.thumbKey) ?? undefined,
    isSensitive: v.isSensitive,
    storyboard: v.storyboardKey
      ? {
          enabled: true,
          url: resolveMediaUrl(v.storyboardKey) as any,
          frameW: v.storyboardFrameW ?? undefined,
          frameH: v.storyboardFrameH ?? undefined,
          cols: v.storyboardCols,
          rows: v.storyboardRows,
          count: v.storyboardCount,
        }
      : { enabled: false, url: null },
  }));

  return <TikTokVerticalFeed items={items} sensitiveMode={sensitiveMode} />;
}
