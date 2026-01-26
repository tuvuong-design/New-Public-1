import { prisma } from "@/lib/prisma";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { getSiteConfig } from "@/lib/siteConfig";
import { auth } from "@/lib/auth";
import { getActiveMembershipTier } from "@/lib/membership";
import { getSensitiveModeForUser, shouldHideSensitiveInListings, type SensitiveMode } from "@/lib/sensitive";
import { isAdAllowedForRequest } from "@/lib/userAgent";
import { headers } from "next/headers";
import TikTokVerticalFeed, { TikTokItem } from "@/components/tiktok/TikTokVerticalFeed";
import SensitiveThumb from "@/components/sensitive/SensitiveThumb";
import TrackedVideoLink from "@/components/analytics/TrackedVideoLink";

export const dynamic = "force-dynamic";

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

type VideoRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  isSensitive: boolean;
  thumbKey: string | null;
  masterM3u8Key: string | null;
  hlsBasePath: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  starCount: number;
  giftCount: number;
  storyboardKey: string | null;
  storyboardFrameW: number | null;
  storyboardFrameH: number | null;
  storyboardCols: number | null;
  storyboardRows: number | null;
  storyboardCount: number | null;
  storyboardIntervalMs: number | null;
  createdAt: Date;
};

function buildVideoItem(
  v: VideoRow,
  sponsored: boolean,
  storyboardEnabled: boolean,
  sensitiveMode: SensitiveMode,
): TikTokItem {
  const hlsUrl = resolveMediaUrl(v.masterM3u8Key) ?? "";
  const posterUrl = resolveMediaUrl(v.thumbKey);
  const isSensitive = Boolean(v.isSensitive);

  const storyboard = storyboardEnabled && v.storyboardKey
    ? {
        enabled: true,
        url: resolveMediaUrl(v.storyboardKey) as any,
        frameW: v.storyboardFrameW ?? undefined,
        frameH: v.storyboardFrameH ?? undefined,
        cols: v.storyboardCols,
        rows: v.storyboardRows,
        count: v.storyboardCount,
      }
    : { enabled: false, url: null };

  return {
    kind: "video",
    id: v.id,
    title: v.title,
    hlsUrl,
    posterUrl,
    poster: posterUrl,
    isSensitive,
    ...(sponsored ? { sponsored: true } : {}),
    storyboard,
  };
}
function mixFeedItems({
  normal,
  boosted,
  htmlAd,
  adEnabled,
  everyN,
  topBoosted,
  boostedEveryN,
  storyboardEnabled,
  sensitiveMode,
  posts,
  postEveryN,
}: {
  normal: VideoRow[];
  boosted: VideoRow[];
  htmlAd: string;
  adEnabled: boolean;
  everyN: number;
  topBoosted: number;
  boostedEveryN: number;
  storyboardEnabled: boolean;
  sensitiveMode: SensitiveMode;
  posts?: any[];
  postEveryN?: number;
}): TikTokItem[] {
  const boostedPool = [...boosted];

  const raw: Array<{ kind: "video"; v: VideoRow; sponsored: boolean } | { kind: "ad"; html: string }> = [];

  // Pin a few sponsored items at the top
  for (let i = 0; i < topBoosted && boostedPool.length > 0; i++) {
    raw.push({ kind: "video", v: boostedPool.shift()!, sponsored: true });
  }

  let normalCount = 0;
  for (const v of normal) {
    raw.push({ kind: "video", v, sponsored: false });
    normalCount++;

    if (boostedEveryN > 0 && boostedPool.length > 0 && normalCount % boostedEveryN === 0) {
      raw.push({ kind: "video", v: boostedPool.shift()!, sponsored: true });
    }

    if (adEnabled && everyN > 0 && normalCount % everyN === 0) {
      raw.push({ kind: "ad", html: htmlAd });
    }
  }

  // Map to TikTok items
  let items: TikTokItem[] = raw.map((it, idx) => {
    if (it.kind === "ad") {
      return {
        kind: "ad",
        id: `ad-${idx}`,
        scope: "FEED",
        html: it.html,
      } as any;
    }
    return buildVideoItem(it.v, it.sponsored, storyboardEnabled, sensitiveMode);
  });

  // Interleave community posts after every N videos (skip ads)
  if (posts && posts.length && postEveryN && postEveryN > 0) {
    const out: TikTokItem[] = [];
    let vCount = 0;
    let pIdx = 0;
    for (const it of items) {
      out.push(it);
      if (it.kind === "video") {
        vCount++;
        if (pIdx < posts.length && vCount % postEveryN === 0) {
          out.push(posts[pIdx++] as any);
        }
      }
    }
    items = out;
  }

  return items;
}

export default async function FeedPage() {
  const cfg = await getSiteConfig();
  const tikTok = Boolean((cfg as any).feedTikTokEnabled);
  const storyboardEnabled = Boolean((cfg as any).storyboardEnabled);

  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const sensitiveMode = await getSensitiveModeForUser(viewerId ?? null);

  const viewerMem = {
    membershipTier: ((session?.user as any)?.membershipTier ?? "NONE") as any,
    membershipExpiresAt: (session?.user as any)?.membershipExpiresAt ? new Date(((session?.user as any).membershipExpiresAt) as any) : null,
  };
  const activeTier = getActiveMembershipTier(viewerMem as any);
  const hideHtmlAdsForMember = activeTier !== "NONE";
  const hideBoostAds = activeTier === "PREMIUM_PLUS" && Boolean((session?.user as any)?.premiumPlusHideBoostAds);
  const allowAccess = activeTier === "PREMIUM_PLUS" ? { in: ["PUBLIC", "PREMIUM_PLUS"] } : "PUBLIC";

  const videoWhere: any = { status: "PUBLISHED" };
  videoWhere.access = allowAccess;
  if (shouldHideSensitiveInListings(sensitiveMode)) videoWhere.isSensitive = false;

  const boostedVideoWhere: any = { status: "PUBLISHED" };
  boostedVideoWhere.access = allowAccess;
  if (shouldHideSensitiveInListings(sensitiveMode)) boostedVideoWhere.isSensitive = false;

  const [adPlacement, boostedOrders, videos] = await Promise.all([
    prisma.adPlacement.findUnique({ where: { scope: "FEED" } }),
    prisma.boostOrder.findMany({
      where: { status: "ACTIVE", OR: [{ endAt: null }, { endAt: { gt: new Date() } }], video: boostedVideoWhere },
      orderBy: { startAt: "desc" },
      take: 25,
      include: { video: true },
    }),
    prisma.video.findMany({
      where: videoWhere,
      orderBy: { createdAt: "desc" },
      take: tikTok ? 120 : 60,
    }),
  ]);

  const boostedVideos = boostedOrders.map((o) => o.video).filter(Boolean) as any as VideoRow[];
  const boostedIds = new Set(boostedVideos.map((v) => v.id));

  const normal = videos.filter((v: any) => !boostedIds.has(v.id)) as any as VideoRow[];

  // Community posts (for shorts feed)
  const postsRaw = await prisma.communityPost.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: 24,
    include: {
      author: { select: { id: true, name: true } },
      pollOptions: {
        orderBy: { sort: "asc" },
        select: { id: true, text: true, _count: { select: { votes: true } } },
      },
    },
  });
  const postIds = postsRaw.map((p) => p.id);
  const viewerVotes = viewerId && postIds.length
    ? await prisma.communityPollVote.findMany({ where: { userId: viewerId, postId: { in: postIds } }, select: { postId: true, optionId: true } })
    : [];
  const voteMap = new Map(viewerVotes.map((v) => [v.postId, v.optionId]));
  const postItems = postsRaw.map((p) => ({
    kind: "post" as const,
    id: p.id,
    authorId: p.authorId,
    authorName: p.author?.name ?? "Unknown",
    type: p.type,
    text: p.text,
    mediaUrl: p.mediaUrl,
    linkUrl: p.linkUrl,
    youtubeUrl: p.youtubeUrl,
    createdAt: p.createdAt.toISOString(),
    pollOptions: p.pollOptions?.map((o) => ({ id: o.id, text: o.text, votes: o._count.votes })) ?? [],
    viewerVotedOptionId: voteMap.get(p.id) ?? null,
  }));

  const reqHeaders = headers();
  const adAllowed = adPlacement
    ? isAdAllowedForRequest(
        {
          enabled: adPlacement.enabled,
          showOnDesktop: adPlacement.showOnDesktop,
          showOnTablet: adPlacement.showOnTablet,
          showOnMobile: adPlacement.showOnMobile,
          hideForBots: adPlacement.hideForBots,
        },
        reqHeaders
      )
    : false;
  const adEnabled = Boolean(adPlacement?.enabled && adAllowed && !hideHtmlAdsForMember);
  const everyN = Math.max(2, Math.min(30, adPlacement?.everyN ?? 6));
  const htmlAd = adPlacement?.html ?? "";

  const items = mixFeedItems({
    normal,
    boosted: hideBoostAds ? [] : boostedVideos,
    posts: postItems,
    htmlAd,
    adEnabled,
    everyN,
    topBoosted: 3,
    boostedEveryN: 6,
    storyboardEnabled,
    sensitiveMode,
    postEveryN: 8,
  });

  if (tikTok) {
    return (
      <main>
        <h1>Feed</h1>
        <p className="muted small">TikTok vertical mode (bật/tắt trong /admin/config). Ads slot mix: HTML ads ↔ boosted video.</p>
        <TikTokVerticalFeed items={items} />
      </main>
    );
  }

  // Grid feed: show Sponsored block + mix (ads appear as cards)
  return (
    <main>
      <h1>Feed</h1>
      <p className="muted small">Grid list. Có thể bật TikTok vertical trong /admin/config.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {items.map((it) => {
          if (it.kind === "ad") {
            return (
              <div key={it.id} className="card">
                <div className="small muted" style={{ marginBottom: 6 }}>Sponsored</div>
                <div dangerouslySetInnerHTML={{ __html: it.html }} />
              </div>
            );
          }

          const v: any = it;
          const href = `/v/${v.id}`;
          return (
            <div key={v.id} className="card" style={v.sponsored ? { border: "1px solid #ffd7a8" } : undefined}>
              <TrackedVideoLink href={href} videoId={v.id} source="FEED" placement={v.sponsored ? "boosted" : "feed"}>
                <div style={{ aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", background: "#f3f3f3" }}>
                  <SensitiveThumb
                    src={v.poster ?? null}
                    alt={v.title}
                    isSensitive={Boolean(v.isSensitive)}
                    mode={sensitiveMode}
                  />
                </div>
                <div style={{ marginTop: 10, fontWeight: 800 }}>
                  {v.sponsored ? <span className="small muted">Sponsored • Boosted • </span> : null}
                  {v.title}
                </div>
                <div className="small muted">
                  {v.viewCount} views • {v.likeCount} likes • {v.commentCount} comments • {v.shareCount} shares
                </div>
              </TrackedVideoLink>
            </div>
          );
        })}
      </div>
    </main>
  );
}
