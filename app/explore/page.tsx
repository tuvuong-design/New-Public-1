import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, take: 50 }),
    prisma.tag.findMany({
      take: 50,
      orderBy: { videoTags: { _count: "desc" } },
      select: { id: true, name: true, slug: true, _count: { select: { videoTags: true } } },
    }).catch(async () => {
      // Prisma older version might not support orderBy by relation count; fallback to raw-ish query via groupBy
      const rows = await prisma.videoTag.groupBy({ by: ["tagId"], _count: { tagId: true }, orderBy: { _count: { tagId: "desc" } }, take: 50 });
      const ids = rows.map((r) => r.tagId);
      const list = await prisma.tag.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true } });
      const map = new Map(rows.map((r) => [r.tagId, r._count.tagId]));
      return list.map((t) => ({ ...t, _count: { videoTags: map.get(t.id) ?? 0 } }));
    }),
  ]);

  return (
    <main className="space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">Explore</div>
        <div className="small muted mt-1">Task 9: Trending + browse by category / tag.</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn" href="/trending">Trending</a>
          <a className="btn" href="/search">Search</a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="font-extrabold">Categories</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <a key={c.id} className="badge" href={`/category/${c.slug}`}>{c.name}</a>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="font-extrabold">Popular tags</div>
          <div className="small muted mt-1">Top theo số video gắn tag.</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t: any) => (
              <a key={t.id} className="badge" href={`/tag/${t.slug}`}>#{t.name} <span className="muted">({t._count?.videoTags ?? 0})</span></a>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
