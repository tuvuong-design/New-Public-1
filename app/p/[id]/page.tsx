import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import SensitiveThumb from "@/components/sensitive/SensitiveThumb";
import { getSensitiveModeForUser } from "@/lib/sensitive";
import PlaylistOwnerBar from "./ui/PlaylistOwnerBar";
import PlaylistItemsGrid from "./ui/PlaylistItemsGrid";

export const dynamic = "force-dynamic";

export default async function PlaylistPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  const sensitiveMode = await getSensitiveModeForUser(viewerId ?? null);

  const playlist = await prisma.playlist.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, username: true } },
      collaborators: viewerId
        ? { where: { userId: viewerId }, select: { role: true } }
        : { where: { userId: "__none__" }, select: { role: true } },
      items: {
        orderBy: [{ sort: "asc" }, { addedAt: "asc" }],
        take: 500,
        include: { video: true },
      },
    },
  });
  if (!playlist) notFound();

  const role = isAdmin
    ? "OWNER"
    : viewerId && viewerId === playlist.ownerId
      ? "OWNER"
      : playlist.collaborators[0]?.role === "EDITOR"
        ? "EDITOR"
        : playlist.collaborators[0]?.role === "VIEWER"
          ? "VIEWER"
          : "NONE";

  const canView =
    role !== "NONE" || playlist.visibility === "PUBLIC" || playlist.visibility === "UNLISTED";

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="card">
          <div className="text-lg font-extrabold">Private playlist</div>
          <div className="small muted mt-1">Playlist này đang để PRIVATE.</div>
          <div className="mt-3">
            <a className="btn" href="/">Home</a>
          </div>
        </div>
      </main>
    );
  }

  const canEdit = role === "OWNER" || role === "EDITOR";
  const canManage = role === "OWNER";

  const isOwner = role === "OWNER";

  const videos = playlist.items
    .map((it) => it.video)
    .filter(Boolean)
    .filter((v: any) => v.status === "PUBLISHED" || isOwner || isAdmin);

  const coverUrl = playlist.coverKey ? resolveMediaUrl(playlist.coverKey) : null;

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="text-xl font-extrabold">{playlist.title}</div>
            <div className="small muted mt-1">
              by <Link href={`/u/${playlist.ownerId}`}>{playlist.owner?.name ?? playlist.owner?.username ?? "Unknown"}</Link> • {playlist.visibility} • {playlist.items.length} items
              {role !== "NONE" && role !== "OWNER" ? ` • ${role}` : ""}
            </div>
            {playlist.description ? (
              <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                {playlist.description}
              </div>
            ) : null}
            {coverUrl ? (
              <div style={{ marginTop: 10, aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", background: "#f3f3f3" }}>
                <SensitiveThumb src={coverUrl} alt={playlist.title} isSensitive={false} mode={"SHOW"} />
              </div>
            ) : null}
            {playlist.isSeries && playlist.seriesSlug ? (
              <div className="mt-2">
                <a className="text-sm underline" href={`/series/${playlist.seriesSlug}`}>Series page</a>
              </div>
            ) : null}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <a className="btn" href="/playlists">My playlists</a>
            <a className="btn" href="/">Home</a>
          </div>
        </div>
      </div>

      {canManage ? (
        <PlaylistOwnerBar
          playlistId={playlist.id}
          initialTitle={playlist.title}
          initialDescription={playlist.description ?? ""}
          initialVisibility={playlist.visibility as any}
          initialIsSeries={Boolean(playlist.isSeries)}
          initialSeriesSlug={playlist.seriesSlug ?? ""}
          initialSeriesDescription={playlist.seriesDescription ?? ""}
          coverUrl={coverUrl}
        />
      ) : null}

      <div className="card">
        <PlaylistItemsGrid
          playlistId={playlist.id}
          items={playlist.items.map((it) => ({
            id: it.id,
            sort: it.sort,
            video: it.video
              ? {
                  id: it.video.id,
                  title: it.video.title,
                  thumbKey: it.video.thumbKey,
                  viewCount: it.video.viewCount,
                  likeCount: it.video.likeCount,
                  starCount: it.video.starCount,
                  status: it.video.status,
                  isSensitive: Boolean((it.video as any).isSensitive),
                }
              : null,
          })) as any}
          canEdit={canEdit}
          canSeeUnpublished={Boolean(isOwner || isAdmin)}
          sensitiveMode={sensitiveMode as any}
        />
      </div>
    </main>
  );
}
