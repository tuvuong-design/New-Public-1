import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import SensitiveThumb from "@/components/sensitive/SensitiveThumb";
import { getSensitiveModeForUser } from "@/lib/sensitive";

export const dynamic = "force-dynamic";

export default async function SeriesPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  const sensitiveMode = await getSensitiveModeForUser(viewerId ?? null);

  const playlist = await prisma.playlist.findFirst({
    where: { isSeries: true, seriesSlug: params.slug },
    include: {
      owner: { select: { id: true, name: true, username: true } },
      collaborators: viewerId
        ? { where: { userId: viewerId }, select: { role: true } }
        : { where: { userId: "__none__" }, select: { role: true } },
      items: { orderBy: [{ sort: "asc" }, { addedAt: "asc" }], take: 500, include: { video: true } },
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

  const canView = role !== "NONE" || playlist.visibility === "PUBLIC" || playlist.visibility === "UNLISTED";
  if (!canView) notFound();

  const isOwner = role === "OWNER";
  const canSeeUnpublished = Boolean(isOwner || isAdmin);

  const coverUrl = playlist.coverKey ? resolveMediaUrl(playlist.coverKey) : null;

  const items = playlist.items
    .map((it) => it.video)
    .filter(Boolean)
    .filter((v: any) => v.status === "PUBLISHED" || canSeeUnpublished);

  return (
    <main className="mx-auto max-w-5xl px-2 py-4 space-y-4">
      <div className="card">
        <div className="text-2xl font-extrabold">{playlist.title}</div>
        <div className="small muted mt-1">
          by <Link href={`/u/${playlist.ownerId}`}>{playlist.owner?.name ?? playlist.owner?.username ?? "Unknown"}</Link> • {items.length} episodes • {playlist.visibility}
        </div>
        {playlist.seriesDescription ? (
          <div className="small" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{playlist.seriesDescription}</div>
        ) : null}
        {coverUrl ? (
          <div style={{ marginTop: 12, aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", background: "#f3f3f3" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={playlist.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ) : null}
      </div>

      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {items.map((v: any) => (
            <div key={v.id} className="card">
              <Link href={`/v/${v.id}?list=${encodeURIComponent(playlist.id)}`}>
                <div style={{ fontWeight: 900 }}>{v.title}</div>
                <div className="small muted mt-1">{v.viewCount} views • {v.likeCount} likes • {v.starCount} stars</div>
                <div style={{ marginTop: 10, aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", background: "#f3f3f3" }}>
                  <SensitiveThumb src={resolveMediaUrl(v.thumbKey)} alt={v.title} isSensitive={Boolean((v as any).isSensitive)} mode={sensitiveMode as any} />
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <a className="btn" href={`/p/${playlist.id}`}>Open playlist</a>
      </div>
    </main>
  );
}
