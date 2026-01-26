import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import SmartImage from "@/components/media/SmartImage";
import CommunityPoll from "@/components/community/CommunityPoll";
import { getActiveMembershipTier } from "@/lib/membership";

export const dynamic = "force-dynamic";

export default async function SubscriptionFeedPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const mem = {
    membershipTier: ((session?.user as any)?.membershipTier ?? "NONE") as any,
    membershipExpiresAt: (session?.user as any)?.membershipExpiresAt ? new Date(((session?.user as any).membershipExpiresAt) as any) : null,
  };
  const tier = getActiveMembershipTier(mem);
  const allowAccess: any = tier === "PREMIUM_PLUS" ? { in: ["PUBLIC", "PREMIUM_PLUS"] } : "PUBLIC";

  const subs = await prisma.subscription.findMany({
    where: { subscriberId: userId },
    select: { channelUserId: true },
  });
  const channelIds = subs.map((s) => s.channelUserId);

  if (channelIds.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <div className="card">
          <div className="text-xl font-extrabold">Subscriptions</div>
          <div className="small muted mt-1">Bạn chưa subscribe kênh nào.</div>
          <div className="mt-3">
            <Link className="btn" href="/trending">
              Khám phá Trending
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [posts, videos] = await Promise.all([
    prisma.communityPost.findMany({
      where: { authorId: { in: channelIds }, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        author: { select: { id: true, name: true } },
        pollOptions: {
          orderBy: { sort: "asc" },
          include: { votes: { select: { id: true, userId: true } } },
        },
      },
    }),
    prisma.video.findMany({
      where: {
        status: "PUBLISHED",
        access: allowAccess,
        authorId: { in: channelIds },
      },
      orderBy: { createdAt: "desc" },
      take: 48,
      select: {
        id: true,
        title: true,
        thumbKey: true,
        durationSec: true,
        author: { select: { id: true, name: true } },
        createdAt: true,
      },
    }),
  ]);

  const viewerVotes = new Map<string, string>();
  for (const p of posts) {
    if (p.type === "POLL") {
      const voted = p.pollOptions.flatMap((o) => o.votes).find((v) => v.userId === userId);
      if (voted) viewerVotes.set(p.id, voted.id); // we store voteId? Actually need optionId; We'll compute later.
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="card">
        <div className="text-xl font-extrabold">Subscriptions</div>
        <div className="small muted mt-1">Bài đăng + video mới nhất từ các kênh bạn đã subscribe.</div>
      </div>

      <section className="space-y-3">
        <div className="text-sm font-semibold">Community</div>
        {posts.length === 0 ? (
          <div className="small muted">Chưa có bài đăng.</div>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => {
              const options = p.pollOptions.map((o) => ({
                id: o.id,
                text: o.text,
                votes: o.votes.length,
              }));
              const myOpt = p.pollOptions.find((o) => o.votes.some((v) => v.userId === userId))?.id ?? null;
              return (
                <div key={p.id} className="card">
                  <div className="small muted">
                    <Link className="underline" href={`/u/${p.authorId}`}>
                      {p.author?.name ?? "User"}
                    </Link>{" "}
                    • {p.createdAt.toLocaleString()}
                  </div>
                  {p.text ? <div className="mt-2 whitespace-pre-wrap">{p.text}</div> : null}
                  {p.type === "LINK" && p.linkUrl ? (
                    <div className="mt-2">
                      <a className="underline" href={p.linkUrl} target="_blank" rel="noreferrer">
                        {p.linkUrl}
                      </a>
                    </div>
                  ) : null}
                  {p.type === "YOUTUBE" && p.youtubeUrl ? (
                    <div className="mt-2">
                      <a className="underline" href={p.youtubeUrl} target="_blank" rel="noreferrer">
                        {p.youtubeUrl}
                      </a>
                    </div>
                  ) : null}
                  {p.type === "POLL" ? (
                    <div className="mt-3">
                      {p.pollQuestion ? <div className="text-sm font-semibold">{p.pollQuestion}</div> : null}
                      <div className="mt-2">
                        <CommunityPoll postId={p.id} options={options} viewerVotedOptionId={myOpt} />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="text-sm font-semibold">Videos</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {videos.map((v) => (
            <Link key={v.id} href={`/v/${v.id}`} className="card block overflow-hidden">
              <div className="aspect-video w-full bg-black">
                {v.thumbKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <SmartImage
                    src={resolveMediaUrl(v.thumbKey) ?? ""}
                    alt={v.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 300px"
                  />
                ) : null}
              </div>
              <div className="p-3">
                <div className="font-semibold line-clamp-2">{v.title}</div>
                <div className="small muted mt-1">{v.author?.name ?? "User"}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
