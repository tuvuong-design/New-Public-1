import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import SensitiveThumb from "@/components/sensitive/SensitiveThumb";
import TrackedVideoLink from "@/components/analytics/TrackedVideoLink";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { getSensitiveModeForUser } from "@/lib/sensitive";
import CommunityPoll from "@/components/community/CommunityPoll";
import { getActiveMembershipTier } from "@/lib/membership";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  const sensitiveMode = await getSensitiveModeForUser(viewerId ?? null);

  const viewerMem = {
    membershipTier: ((session?.user as any)?.membershipTier ?? "NONE") as any,
    membershipExpiresAt: (session?.user as any)?.membershipExpiresAt ? new Date(((session?.user as any).membershipExpiresAt) as any) : null,
  };
  const activeTier = getActiveMembershipTier(viewerMem as any);
  const isPPlus = activeTier === "PREMIUM_PLUS";
  const hideBoostAds = isPPlus && Boolean((session?.user as any)?.premiumPlusHideBoostAds);

  const boostedOrders = hideBoostAds
    ? []
    : await prisma.boostOrder.findMany({
        where: { status: "ACTIVE", endAt: { gt: new Date() } },
        include: { video: true },
        orderBy: { createdAt: "desc" },
        take: 18,
      });

  const boosted = boostedOrders
    .map((b) => b.video)
    .filter((v) => v && v.status === "PUBLISHED")
    .slice(0, 12);

  const recentPosts = await prisma.communityPost.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      author: { select: { id: true, name: true } },
      pollOptions: { orderBy: { sort: "asc" }, include: { _count: { select: { votes: true } } } },
    },
  });

  const voteMap = new Map<string, string>();
  if (viewerId && recentPosts.length) {
    const votes = await prisma.communityPollVote.findMany({
      where: { userId: viewerId, postId: { in: recentPosts.map((p) => p.id) } },
      select: { postId: true, optionId: true },
    });
    for (const v of votes) voteMap.set(v.postId, v.optionId);
  }

  const recentProgress = viewerId ? await prisma.videoProgress.findMany({
    where: { userId: viewerId },
    orderBy: { updatedAt: "desc" },
    take: 6,
    include: { video: true },
  }) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <div className="card">
        <div className="text-xl font-extrabold">Home</div>
        <div className="small muted mt-1">
          Đây là trang chủ demo. Bạn có thể vào Feed để xem dạng TikTok vertical.
        </div>
        <ul className="small" style={{ marginTop: 10, lineHeight: 1.9 }}>
          <li>
            <a href="/feed">Feed</a>
          </li>
          <li>
            <a href="/subscriptions">Subscriptions</a>
          </li>
          <li>
            <a href="/premium">Premium</a>
          </li>
          <li>
            <a href="/nft">NFT</a>
          </li>
          <li>
            <a href="/studio">Studio</a>
          </li>
        </ul>
      </div>

      
{viewerId ? (
  <div className="card">
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontWeight: 800 }}>Continue watching</div>
        <div className="small muted">Tiếp tục xem từ lần trước (đồng bộ đa thiết bị).</div>
      </div>
      <a className="small" href="/history">
        Open history
      </a>
    </div>

    {recentProgress.length === 0 ? (
      <div className="small muted" style={{ marginTop: 10 }}>
        Chưa có lịch sử xem.
      </div>
    ) : (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
          marginTop: 12,
        }}
      >
        {recentProgress
          .filter((p) => p.video && (p.video as any).status === "PUBLISHED")
          .map((p) => (
            <div key={p.id} className="card">
              <TrackedVideoLink href={`/v/${(p.video as any).id}?t=${p.seconds}`} videoId={(p.video as any).id} source="HOME" placement="continue_watching">
                <div style={{ fontWeight: 800 }}>{(p.video as any).title}</div>
                <div className="small muted">
                  {p.seconds}s • updated {new Date(p.updatedAt).toLocaleString()}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    aspectRatio: "16/9",
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "#f3f3f3",
                  }}
                >
                  <SensitiveThumb
                    src={resolveMediaUrl((p.video as any).thumbKey)}
                    alt={(p.video as any).title}
                    isSensitive={Boolean((p.video as any).isSensitive)}
                    mode={sensitiveMode}
                  />
                </div>
              </TrackedVideoLink>
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    height: 8,
                    background: "#eee",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: 8,
                      width: `${Math.max(0, Math.min(100, Math.floor(((p.seconds ?? 0) / Math.max(1, ((p.video as any).durationSec ?? 600))) * 100)))}%`,
                      background: "#111",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
      </div>
    )}
  </div>
) : null}

<div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800 }}>Sponsored / Boosted</div>
            <div className="small muted">Video được boost sẽ ưu tiên hiển thị chỗ dễ thấy.</div>
          </div>
          <a className="small" href="/feed">
            Open feed
          </a>
        </div>

        {hideBoostAds ? (
          <div className="small muted" style={{ marginTop: 10 }}>
            Bạn đang bật chế độ ẩn Boosted ads (Premium+).
          </div>
        ) : boosted.length === 0 ? (
          <div className="small muted" style={{ marginTop: 10 }}>
            Chưa có video boost.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            {boosted.map((v) => (
              <div key={v.id} className="card" style={{ border: "1px solid #ffd7a8" }}>
                <TrackedVideoLink href={`/v/${v.id}`} videoId={v.id} source="HOME" placement="home_boosted">
                  <div className="small muted">Sponsored • Boosted</div>
                  <div style={{ fontWeight: 800, marginTop: 6 }}>{v.title}</div>
                  <div
                    style={{
                      marginTop: 10,
                      aspectRatio: "16/9",
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "#f3f3f3",
                    }}
                  >
                    <SensitiveThumb
                      src={resolveMediaUrl(v.thumbKey)}
                      alt={v.title}
                      isSensitive={Boolean((v as any).isSensitive)}
                      mode={sensitiveMode}
                    />
                  </div>
                </TrackedVideoLink>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800 }}>Community posts</div>
            <div className="small muted">Bài đăng cộng đồng mới nhất.</div>
          </div>
          <a className="small" href="/subscriptions">
            Open subscriptions
          </a>
        </div>

        {recentPosts.length === 0 ? (
          <div className="small muted" style={{ marginTop: 10 }}>
            Chưa có bài đăng.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            {recentPosts.map((p) => (
              <div key={p.id} className="card">
                <div className="small muted">
                  <Link href={`/u/${p.authorId}`}>{p.author?.name ?? "Unknown"}</Link> •{" "}
                  {new Date(p.createdAt).toLocaleString()}
                </div>
                {p.text ? (
                  <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                    {p.text}
                  </div>
                ) : null}
                {p.youtubeUrl ? (
                  <a
                    className="small"
                    style={{ display: "inline-block", marginTop: 8, textDecoration: "underline" }}
                    href={p.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    YouTube
                  </a>
                ) : null}
                {p.linkUrl ? (
                  <a
                    className="small"
                    style={{ display: "inline-block", marginTop: 8, textDecoration: "underline" }}
                    href={p.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mở link
                  </a>
                ) : null}
                {p.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.mediaUrl} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 10 }} />
                ) : null}
                {p.pollOptions && p.pollOptions.length ? (
                  <div style={{ marginTop: 10 }}>
                    <CommunityPoll
                      postId={p.id}
                      options={p.pollOptions.map((o) => ({ id: o.id, text: o.text, votes: o._count.votes }))}
                      viewerVotedOptionId={voteMap.get(p.id) ?? null}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin ? (
        <div className="card small muted">Bạn đang đăng nhập bằng ADMIN.</div>
      ) : null}
    </main>
  );
}
