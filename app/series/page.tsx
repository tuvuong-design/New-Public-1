import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export const dynamic = "force-dynamic";

export default async function SeriesIndexPage() {
  const series = await prisma.playlist.findMany({
    where: { isSeries: true, visibility: { in: ["PUBLIC", "UNLISTED"] } },
    orderBy: { updatedAt: "desc" },
    take: 60,
    select: {
      id: true,
      title: true,
      coverKey: true,
      seriesSlug: true,
      owner: { select: { id: true, name: true, username: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-2 py-4 space-y-4">
      <div className="card">
        <div className="text-2xl font-extrabold">Series</div>
        <div className="small muted mt-1">Danh sách playlist dạng series (creator).</div>
      </div>

      {series.length === 0 ? (
        <div className="card">
          <div className="small muted">Chưa có series public.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {series.map((s) => {
            const href = s.seriesSlug ? `/series/${s.seriesSlug}` : `/p/${s.id}`;
            const cover = s.coverKey ? resolveMediaUrl(s.coverKey) : null;
            return (
              <div key={s.id} className="card">
                <Link href={href}>
                  <div style={{ fontWeight: 900 }}>{s.title}</div>
                  <div className="small muted mt-1">
                    by {s.owner?.name ?? s.owner?.username ?? "Unknown"} • {s._count.items} episodes
                  </div>
                  {cover ? (
                    <div style={{ marginTop: 10, aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", background: "#f3f3f3" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cover} alt={s.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ) : null}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
