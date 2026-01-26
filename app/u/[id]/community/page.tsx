import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CommunityPostComposer from "@/components/community/CommunityPostComposer";
import CommunityPoll from "@/components/community/CommunityPoll";

export const dynamic = "force-dynamic";

export default async function CommunityPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  const authorId = params.id;

  const author = await prisma.user.findUnique({ where: { id: authorId }, select: { id: true, name: true } });
  if (!author) {
    return <div className="card">Không tìm thấy kênh.</div>;
  }

  const posts = await prisma.communityPost.findMany({
    where: { authorId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      author: { select: { id: true, name: true } },
      pollOptions: { orderBy: { sort: "asc" }, include: { votes: true } },
      pollVotes: viewerId ? { where: { userId: viewerId } } : false,
    },
  });

  const canPost = Boolean(viewerId && (viewerId === authorId || isAdmin));

  return (
    <div className="space-y-4">
      {canPost ? (
        <div className="card space-y-3">
          <div className="text-sm font-semibold">Đăng bài Community</div>
          <CommunityPostComposer />
        </div>
      ) : null}

      {posts.length === 0 ? (
        <div className="card small muted">Chưa có bài viết community.</div>
      ) : null}

      <div className="space-y-3">
        {posts.map((p) => {
          const vote = (p as any).pollVotes?.[0] ?? null;
          return (
            <div key={p.id} className="card space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{p.author?.name ?? "(unknown)"}</div>
                <div className="small muted">{new Date(p.createdAt).toLocaleString()}</div>
              </div>

              {p.text ? <div className="whitespace-pre-wrap text-sm">{p.text}</div> : null}

              {p.type === "LINK" && p.linkUrl ? (
                <a className="small underline" href={p.linkUrl} target="_blank" rel="noreferrer">
                  {p.linkUrl}
                </a>
              ) : null}

              {p.type === "YOUTUBE" && p.youtubeUrl ? (
                <a className="small underline" href={p.youtubeUrl} target="_blank" rel="noreferrer">
                  {p.youtubeUrl}
                </a>
              ) : null}

              {(p.type === "IMAGE" || p.type === "GIF") && p.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.mediaUrl} alt="media" className="w-full rounded-md border" />
              ) : null}

              {p.type === "POLL" ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">{p.pollQuestion ?? "Poll"}</div>
                  <CommunityPoll
                    postId={p.id}
                    viewerVotedOptionId={vote?.optionId ?? null}
                    options={(p.pollOptions ?? []).map((o) => ({
                      id: o.id,
                      text: o.text,
                      votes: o.votes?.length ?? 0,
                    }))}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
