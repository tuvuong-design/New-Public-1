import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { Metadata } from "next";
import { notFound, unauthorized } from "next/navigation";
import { cookies } from "next/headers";
import VideoPlayerClient from "@/components/player/VideoPlayerClient";
import AdStream from "@/components/ads/AdStream";
import Comments from "./ui/Comments";
import LikeButton from "./ui/LikeButton";
import ShareButton from "./ui/ShareButton";
import StarGiftButton from "./ui/StarGiftButton";
import ReportButton from "./ui/ReportButton";
import TipCreatorButton from "@/components/tips/TipCreatorButton";
import AddToPlaylistButton from "./ui/AddToPlaylistButton";
import WatchLaterToggleForm from "./ui/WatchLaterToggleForm";
import PremiumGateClient from "./ui/PremiumGateClient";
import ClipMakerClient from "./ui/ClipMakerClient";
import UpNextAutoplayClient from "./ui/UpNextAutoplayClient";
import { getSiteConfig } from "@/lib/siteConfig";
import { auth } from "@/lib/auth";
import { getSensitiveModeForUser, type SensitiveMode } from "@/lib/sensitive";
import { canInteractWithVideoDb, canViewVideoDb } from "@/lib/videoAccessDb";
import ProgressSaver from "./ui/ProgressSaver";
import Chapters from "./ui/Chapters";
import { getSimilarVideosAdvanced } from "@/lib/videos/similar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SensitiveVideoGate from "@/components/sensitive/SensitiveVideoGate";
import { getVideoPasswordCookieName, verifyVideoPasswordToken } from "@/lib/videoPassword";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { resolveStreamCandidates } from "@/lib/playback/resolveStream";
import { getAssignedVideoExperimentVariant } from "@/lib/experiments/assign";
import RealtimeViewersBadge from "@/components/analytics/RealtimeViewersBadge";
import CreatorGoalBar from "@/components/creator/CreatorGoalBar";
import { monthKey } from "@/lib/membership";
import { getViewerFanClubTier } from "@/lib/creatorFanClub";
import EarlyAccessGateClient from "./ui/EarlyAccessGateClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const v = await prisma.video.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, description: true, isSensitive: true },
  });

  if (!v) return { title: "Not found" };

  const title = v.title;
  const description = String(v.description ?? "").slice(0, 220);
  const ogImage = `/api/og/video/${v.id}`;

  const meta: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/v/${v.id}`,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };

  if (v.isSensitive) {
    meta.other = {
      ...(meta.other ?? {}),
      rating: "adult",
    };
  }

  return meta;
}

export default async function VideoPage({ params, searchParams }: { params: { id: string }; searchParams?: { list?: string } }) {
  const v = await prisma.video.findUnique({
    where: { id: params.id },
    include: { author: true, category: true, channel: true, subtitles: true },
  });
  if (!v) notFound();

  const site = await getSiteConfig();
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const viewerFanClubTier = viewerId && v.authorId && viewerId !== v.authorId ? await getViewerFanClubTier(viewerId, v.authorId) : null;
  const viewerFanClubLabel = viewerFanClubTier ? (viewerFanClubTier === "BRONZE" ? "Bronze" : viewerFanClubTier === "SILVER" ? "Silver" : "Gold") : null;
  const sensitiveMode = await getSensitiveModeForUser(viewerId ?? null);
  const access = ((v as any).access ?? "PUBLIC") as any;
  const gateRow = {
    id: v.id,
    status: (v.status as any),
    access,
    authorId: v.authorId,
    interactionsLocked: Boolean((v as any).interactionsLocked),
    earlyAccessTier: (v as any).earlyAccessTier ?? null,
    earlyAccessUntil: (v as any).earlyAccessUntil ?? null,
  } as any;

  const now = new Date();
  const earlyAccessActive = access === "PUBLIC" && Boolean((v as any).earlyAccessTier) && Boolean((v as any).earlyAccessUntil) && new Date((v as any).earlyAccessUntil as any).getTime() > now.getTime();

  const canView = await canViewVideoDb(gateRow, session);
  if (!canView) {
    if (earlyAccessActive) {
      const untilIso = new Date((v as any).earlyAccessUntil as any).toISOString();
      const plans = v.authorId
        ? await prisma.creatorMembershipPlan.findMany({
            where: { creatorId: v.authorId, status: "ACTIVE" },
            orderBy: [{ tier: "asc" }, { priceStars: "asc" }],
            take: 10,
          })
        : [];

      return (
        <main className="mx-auto max-w-2xl space-y-3">
          <EarlyAccessGateClient
            creatorId={v.authorId ?? ""}
            creatorName={v.author?.name ?? "Creator"}
            requiredTier={(v as any).earlyAccessTier as any}
            untilIso={untilIso}
            plans={plans as any}
            viewerTier={viewerFanClubTier as any}
            loggedIn={Boolean(viewerId)}
          />
        </main>
      );
    }
    if (access === "PREMIUM_PLUS") {
      return (
        <main className="mx-auto max-w-2xl space-y-3">
          <div className="card">
            <div className="text-lg font-extrabold">Video này chỉ dành cho Premium+</div>
            <div className="small muted mt-1">Nâng cấp Premium+ để xem video riêng tư cho hội viên.</div>
            <div className="mt-3">
              <a className="btn" href="/premium">Xem gói Premium+</a>
            </div>
          </div>
        </main>
      );
    }

    if (access === "PREMIUM") {
      if (!viewerId) {
        return (
          <main className="mx-auto max-w-2xl space-y-3">
            <div className="card">
              <div className="text-lg font-extrabold">Nội dung Premium</div>
              <div className="small muted mt-1">Bạn cần đăng nhập để tham gia Fan Club hoặc mở khoá video.</div>
              <div className="mt-3">
                <a className="btn" href="/api/auth/signin">Đăng nhập</a>
              </div>
            </div>
          </main>
        );
      }

      const nftGates = await prisma.videoNftGate.findMany({ where: { videoId: v.id, enabled: true } });
      const walletCount = await prisma.userWallet.count({ where: { userId: viewerId, verifiedAt: { not: null } } });
      const nftGateChains = Array.from(new Set(nftGates.map((g) => String(g.chain))));

      const plans = await prisma.creatorMembershipPlan.findMany({
        where: { userId: v.authorId, isActive: true },
        orderBy: [{ sort: "asc" }, { starsPrice: "asc" }],
        select: { id: true, title: true, starsPrice: true, durationDays: true, benefits: true, tier: true },
      });

      return (
        <main className="mx-auto max-w-3xl px-2 py-4">
          <PremiumGateClient
            videoId={v.id}
            creatorId={v.authorId}
            creatorName={v.author?.name ?? "Creator"}
            premiumUnlockStars={Number((v as any).premiumUnlockStars ?? 0)}
            plans={plans as any}
            nftUnlockAvailable={Boolean((site as any).nftPremiumUnlockEnabled) && nftGates.length > 0}
            hasLinkedWallet={walletCount > 0}
            nftGateChains={nftGateChains}
          />
        </main>
      );
    }

    notFound();
  }
  const interactionsAllowed = await canInteractWithVideoDb(gateRow, session);
  const canModerate = Boolean(session?.user?.role === "ADMIN") || (viewerId && viewerId === v.authorId);

  const watchLaterActive = viewerId
    ? Boolean(
        await prisma.watchLaterItem.findUnique({
          where: { userId_videoId: { userId: viewerId, videoId: v.id } },
          select: { id: true },
        })
      )
    : false;

  // Password gate: return HTTP 401 (via `unauthorized()`) instead of 404.
  // Bypass for owner/admin.
  if (v.accessPasswordHash && !canModerate) {
    const jar = cookies();
    const token = jar.get(getVideoPasswordCookieName())?.value;
    const ok = token ? verifyVideoPasswordToken(token, v.id) : false;
    if (!ok) {
      unauthorized();
    }
  }

  const isSensitive = Boolean((v as any).isSensitive);

  // A/B experiment assignment (stable per `vsid` cookie when present)
  const jarForExp = cookies();
  const vsid = jarForExp.get("vsid")?.value;
  const assigned = await getAssignedVideoExperimentVariant(v.id, vsid);
  const displayTitle = assigned?.variant.title ?? v.title;
  const displayThumbKey = assigned?.variant.thumbKey ?? v.thumbKey;

  const stream = await resolveStreamCandidates({ videoId: v.id, masterM3u8Key: v.masterM3u8Key, viewerId: viewerId ?? null });
  const hlsUrl = stream.preferred?.url ?? "";
  const hlsCandidates = stream.candidates;
  const poster = resolveMediaUrl(displayThumbKey) ?? undefined;
  // Up next (playlist context > similar cache)
  const listId = typeof searchParams?.list === "string" ? String(searchParams.list).slice(0, 64) : undefined;
  let upNext: { url: string; title: string; thumbUrl: string | null } | null = null;

  async function pickIfViewable(candidate: any, url: string) {
    if (!candidate) return null;
    if (candidate.status === "DELETED") return null;
    const gate = {
      id: candidate.id,
      status: candidate.status as any,
      access: (candidate.access ?? "PUBLIC") as any,
      authorId: candidate.authorId,
      interactionsLocked: Boolean(candidate.interactionsLocked),
    } as any;
    const ok = await canViewVideoDb(gate, session);
    if (!ok) return null;
    return { url, title: candidate.title, thumbUrl: resolveMediaUrl(candidate.thumbKey) };
  }

  if (listId) {
    const pl = await prisma.playlist.findUnique({
      where: { id: listId },
      select: {
        id: true,
        visibility: true,
        ownerId: true,
        collaborators: viewerId
          ? { where: { userId: viewerId }, select: { role: true } }
          : { where: { userId: "__none__" }, select: { role: true } },
        items: {
          orderBy: [{ sort: "asc" }, { addedAt: "asc" }],
          take: 500,
          select: {
            video: {
              select: { id: true, title: true, thumbKey: true, status: true, access: true, authorId: true, interactionsLocked: true },
            },
          },
        },
      },
    });

    const rolePl = isAdmin
      ? "OWNER"
      : viewerId && pl?.ownerId === viewerId
        ? "OWNER"
        : pl?.collaborators?.[0]?.role === "EDITOR"
          ? "EDITOR"
          : pl?.collaborators?.[0]?.role === "VIEWER"
            ? "VIEWER"
            : "NONE";

    const canViewPlaylist = Boolean(pl && (rolePl !== "NONE" || pl.visibility === "PUBLIC" || pl.visibility === "UNLISTED"));

    if (pl && canViewPlaylist) {
      const list = pl.items.map((it) => it.video).filter(Boolean);
      const idx = list.findIndex((x: any) => x.id === v.id);
      if (idx >= 0) {
        for (let j = idx + 1; j < list.length; j++) {
          const cand = list[j];
          const picked = await pickIfViewable(cand, `/v/${cand.id}?list=${encodeURIComponent(listId)}`);
          if (picked) {
            upNext = picked;
            break;
          }
        }
      }
    }
  }

  if (!upNext) {
    const sim = await getSimilarVideosAdvanced(v.id, { take: 8 });
    const ids = sim.map((x) => x.id).filter(Boolean).slice(0, 8);
    if (ids.length) {
      const rows = await prisma.video.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, thumbKey: true, status: true, access: true, authorId: true, interactionsLocked: true },
      });
      const map = new Map(rows.map((r) => [r.id, r]));
      for (const id of ids) {
        const cand = map.get(id);
        const picked = await pickIfViewable(cand, `/v/${id}`);
        if (picked) {
          upNext = picked;
          break;
        }
      }
    }
  }


  const chapters = await prisma.videoChapter.findMany({
    where: { videoId: v.id },
    orderBy: { startSec: "asc" },
    take: 200,
    select: { startSec: true, title: true },
  });

  // Creator goal progress (current month)
  const nowUtc = new Date();
  const mk = monthKey(nowUtc);
  const goal = await prisma.creatorGoal.findUnique({
    where: { creatorId_monthKey: { creatorId: v.authorId, monthKey: mk } },
    select: { title: true, targetStars: true },
  });

  let goalBar: JSX.Element | null = null;
  if (goal && (goal.targetStars ?? 0) > 0) {
    const monthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1, 0, 0, 0));
    const nextMonthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 1, 1, 0, 0, 0));
    const agg = await prisma.videoMetricDaily.aggregate({
      where: {
        day: { gte: monthStart, lt: nextMonthStart },
        video: { authorId: v.authorId },
      },
      _sum: { stars: true },
    });

    const currentStars = Number(agg._sum.stars ?? 0);
    goalBar = <CreatorGoalBar title={goal.title} currentStars={currentStars} targetStars={goal.targetStars} />;
  }

  return (
    <main className="mx-auto max-w-6xl px-2 pb-6">
      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight">{displayTitle}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <span>{v.author?.name ?? "Anonymous"}</span>
            {viewerFanClubLabel ? <Badge variant="secondary">⭐ {viewerFanClubLabel} Member</Badge> : null}
            <span>• {v.viewCount} views • {v.likeCount} likes • {v.starCount} stars</span>
          </div>
          <div className="mt-2">
            <RealtimeViewersBadge videoId={v.id} />
          </div>
          {isSensitive ? (
            <div className="mt-2">
              <Badge variant="destructive">Sensitive</Badge>
            </div>
          ) : null}

          {goalBar ? <div className="mt-3 max-w-md">{goalBar}</div> : null}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <LikeButton videoId={v.id} disabled={!interactionsAllowed} />
          <ShareButton videoId={v.id} initialCount={v.shareCount} disabled={!interactionsAllowed} />
          <StarGiftButton
            videoId={v.id}
            initialStarCount={v.starCount}
            initialGiftCount={v.giftCount}
            disabled={!interactionsAllowed}
          />
          {viewerId ? <AddToPlaylistButton videoId={v.id} disabled={!interactionsAllowed} /> : null}
          {viewerId ? <WatchLaterToggleForm videoId={v.id} active={watchLaterActive} disabled={false} /> : null}
          {viewerId && viewerId !== v.authorId && interactionsAllowed ? (
            <TipCreatorButton toUserId={v.authorId} />
          ) : null}
          <ReportButton videoId={v.id} />
        </div>
      </div>

      {!interactionsAllowed ? (
        <div className="card small muted" style={{ marginTop: 12 }}>
          Chế độ hạn chế: bạn chỉ có thể xem video này. Tương tác (like, comment, tặng sao/quà) đã bị tắt.
        </div>
      ) : null}

      <div className="mt-3">
        {hlsUrl ? (
          isSensitive && sensitiveMode !== "SHOW" ? (
            <SensitiveVideoGate
              mode={sensitiveMode as any}
              hlsUrl={hlsUrl}
              poster={poster}
              title={displayTitle}
              videoId={v.id}
              analytics={{ experimentId: assigned?.experiment.id ?? null, variantId: assigned?.variant.id ?? null }}
              p2pEnabled={Boolean((site as any).playerP2PEnabled) && (v as any).access === "PUBLIC"}
              playerMode="standard"
              candidates={hlsCandidates}
              storyboard={{
                enabled: Boolean((site as any).storyboardEnabled),
                url: resolveMediaUrl(v.storyboardKey),
                frameW: v.storyboardFrameW,
                frameH: v.storyboardFrameH,
                cols: v.storyboardCols,
                rows: v.storyboardRows,
                count: v.storyboardCount,
                intervalMs: v.storyboardIntervalMs,
              }}
            />
          ) : (
            <VideoPlayerClient
              videoId={v.id}
              src={hlsUrl}
              candidates={hlsCandidates}
              poster={poster}
              mode="standard"
              analytics={{ experimentId: assigned?.experiment.id ?? null, variantId: assigned?.variant.id ?? null }}
              p2pEnabled={Boolean((site as any).playerP2PEnabled) && (v as any).access === "PUBLIC"}
              storyboard={{
                enabled: Boolean((site as any).storyboardEnabled),
                url: resolveMediaUrl(v.storyboardKey),
                frameW: v.storyboardFrameW,
                frameH: v.storyboardFrameH,
                cols: v.storyboardCols,
                rows: v.storyboardRows,
                count: v.storyboardCount,
                intervalMs: v.storyboardIntervalMs,
              }}
            />
          )
        ) : (
          <div className="card">HLS chưa sẵn sàng.</div>
        )}
        <ProgressSaver videoId={v.id} />
        <UpNextAutoplayClient currentVideoId={v.id} next={upNext} />
        <Chapters videoId={v.id} chapters={chapters} />
        {/* view count is pinged on first play inside VideoPlayer */}
      </div>

      {/* Mobile (m.youtube.com-like): player -> title -> channel/stats -> action bar */}
      <div className="lg:hidden">
        <h1 className="mt-3 text-lg font-extrabold leading-tight">{displayTitle}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
          <span>{v.author?.name ?? "Anonymous"}</span>
          {viewerFanClubLabel ? <Badge variant="secondary">⭐ {viewerFanClubLabel} Member</Badge> : null}
          <span>• {v.viewCount} views • {v.likeCount} likes • {v.starCount} stars</span>
        </div>
        <div className="mt-2">
          <RealtimeViewersBadge videoId={v.id} />
        </div>
        {isSensitive ? (
          <div className="mt-2">
            <Badge variant="destructive">Sensitive</Badge>
          </div>
        ) : null}

        {goalBar ? <div className="mt-3">{goalBar}</div> : null}


        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <LikeButton videoId={v.id} disabled={!interactionsAllowed} />
          <ShareButton videoId={v.id} initialCount={v.shareCount} disabled={!interactionsAllowed} />
          <StarGiftButton
            videoId={v.id}
            initialStarCount={v.starCount}
            initialGiftCount={v.giftCount}
            disabled={!interactionsAllowed}
          />
          {viewerId ? <WatchLaterToggleForm videoId={v.id} active={watchLaterActive} disabled={false} /> : null}
          {viewerId ? <AddToPlaylistButton videoId={v.id} disabled={!interactionsAllowed} /> : null}
          {viewerId && viewerId !== v.authorId && interactionsAllowed ? (
            <TipCreatorButton toUserId={v.authorId} />
          ) : null}
          <ReportButton videoId={v.id} />
        </div>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[2fr_1fr] lg:gap-4">
        <div className="min-w-0">
          <div className="card">
            <div className="small muted">Mô tả</div>
            <p>{v.description}</p>
            <div className="small muted">
              Category: {v.category?.name ?? "-"} • Channel: {v.channel?.name ?? "-"}
            </div>
          </div>

          <div className="mt-3">
            <AdStream scope="VIDEO" positions={[0]} />
          </div>

          <div className="mt-3">
            <Comments videoId={v.id} disabled={!interactionsAllowed} canModerate={Boolean(canModerate)} />
          </div>
        </div>

        <div className="mt-4 lg:mt-0 min-w-0">
          <div className="card">
            <div style={{ fontWeight: 700 }}>Subtitles</div>
            {v.subtitles.length === 0 ? (
              <div className="small muted">Chưa có subtitle.</div>
            ) : (
              <ul>
                {v.subtitles.map((s) => (
                  <li key={s.id}>
                    <a href={resolveMediaUrl(s.vttKey) ?? "#"}>{s.lang}</a> <span className="small muted">({s.provider})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3">
            <TopSupporters videoId={v.id} />
          </div>

          <div className="mt-3">
            <RelatedVideos currentId={v.id} sensitiveMode={sensitiveMode} />
          </div>
        </div>
      </div>
    </main>
  );
}

async function TopSupporters({ videoId }: { videoId: string }) {
  const rows = await prisma.starTransaction.groupBy({
    by: ["userId"],
    where: { videoId, delta: { lt: 0 }, type: { in: ["GIFT", "STARS"] } },
    _sum: { stars: true },
    _count: { _all: true },
    orderBy: { _sum: { stars: "desc" } },
    take: 10,
  });

  if (rows.length === 0) {
    return (
      <div className="card">
        <div style={{ fontWeight: 700 }}>Top supporters</div>
        <div className="small muted" style={{ marginTop: 6 }}>
          Chưa có ai tặng sao/quà. Hãy là người đầu tiên! ⭐
        </div>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, email: true },
  });
  const map = new Map(users.map((u) => [u.id, u]));

  const total = rows.reduce((acc, r) => acc + (r._sum.stars ?? 0), 0);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Top supporters</div>
        <div className="small muted">⭐ {total}</div>
      </div>

      <ol style={{ marginTop: 10, paddingLeft: 18 }}>
        {rows.map((r, i) => {
          const u = map.get(r.userId);
          const stars = r._sum.stars ?? 0;
          const name = u?.name ?? u?.email ?? "User";
          return (
            <li key={r.userId} style={{ marginBottom: 8 }}>
              <a href={`/u/${r.userId}`} style={{ fontWeight: 700 }}>
                {i === 0 ? "👑 " : ""}
                {name}
              </a>{" "}
              <span className="small muted">• ⭐ {stars} • {r._count._all} tx</span>
            </li>
          );
        })}
      </ol>

      <div className="small muted">
        Tip: vào video → bấm nút ⭐ để tặng quà/sao, sẽ hiện Super Thanks trong comments.
      </div>
    </div>
  );
}

async function RelatedVideos({
  currentId,
  sensitiveMode,
}: {
  currentId: string;
  sensitiveMode: SensitiveMode;
}) {
  const list = await getSimilarVideosAdvanced(currentId, { take: 10 });

  const visibleList =
    sensitiveMode === "HIDE" ? list.filter((v) => !Boolean((v as any).isSensitive)) : list;

  return (
    <div className="space-y-3">
      <AdStream scope="RELATED" positions={[0]} />

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Video tương tự</div>
          <Badge variant="secondary" title="Ưu tiên cùng kênh, cùng category, trùng tags, và full-text ranking">
            Advanced
          </Badge>
        </div>

        <div className="grid gap-3">
          {visibleList.length === 0 ? (
            <div className="small muted">Chưa tìm thấy video tương tự.</div>
          ) : (
            visibleList.map((v) => {
              const thumb = v.thumbKey ? `${env.R2_PUBLIC_BASE_URL}/${v.thumbKey}` : null;
              const isSensitiveV = Boolean((v as any).isSensitive);
              const blurThumb = isSensitiveV && sensitiveMode === "BLUR";
              const channelName = v.channel?.name;
              const authorName = v.author?.name ?? v.author?.email ?? null;

              return (
                <a
                  key={v.id}
                  href={`/v/${v.id}`}
                  className="group grid grid-cols-[96px,1fr] gap-3 rounded-xl p-2 hover:bg-zinc-50"
                >
                  <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt={v.title}
                        className="h-[64px] w-[96px] object-cover transition-transform group-hover:scale-[1.02]"
                        style={blurThumb ? { filter: "blur(14px) brightness(0.75)" } : undefined}
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-[64px] w-[96px] items-center justify-center text-xs text-zinc-500">
                        No thumb
                      </div>
                    )}

                    {isSensitiveV && sensitiveMode !== "SHOW" ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                          Sensitive {sensitiveMode === "HIDE" ? "" : "(blur)"}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="line-clamp-2 text-sm font-semibold group-hover:underline">
                      {v.title}
                    </div>
                    <div className="mt-1 line-clamp-1 text-xs text-zinc-500">
                      {channelName ? `${channelName} • ` : ""}
                      {authorName ? authorName : ""}
                    </div>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}