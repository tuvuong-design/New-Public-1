import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveMembershipTier } from "@/lib/membership";
import { getSensitiveModeForUser, shouldHideSensitiveInListings } from "@/lib/sensitive";
import SensitiveThumb from "@/components/sensitive/SensitiveThumb";
import TrackedVideoLink from "@/components/analytics/TrackedVideoLink";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export const dynamic = "force-dynamic";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pickOrderBy(sort: string | undefined) {
  switch (sort) {
    case "new":
      return [{ createdAt: "desc" as const }];
    case "views":
      return [{ viewCount: "desc" as const }, { createdAt: "desc" as const }];
    case "likes":
      return [{ likeCount: "desc" as const }, { createdAt: "desc" as const }];
    default:
      return [{ viewCount: "desc" as const }, { createdAt: "desc" as const }];
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; tag?: string; category?: string; sort?: string; page?: string };
}) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const sensitiveMode = await getSensitiveModeForUser(viewerId ?? null);

  const tier = getActiveMembershipTier({
    membershipTier: ((session?.user as any)?.membershipTier ?? "NONE") as any,
    membershipExpiresAt: (session?.user as any)?.membershipExpiresAt ? new Date(((session?.user as any).membershipExpiresAt) as any) : null,
  });
  const allowAccess = tier === "PREMIUM_PLUS" ? ({ in: ["PUBLIC", "PREMIUM_PLUS"] } as const) : ("PUBLIC" as const);

  const q = String(searchParams.q ?? "").trim().slice(0, 200);
  const tag = String(searchParams.tag ?? "").trim().slice(0, 64) || undefined;
  const category = String(searchParams.category ?? "").trim().slice(0, 64) || undefined;
  const sort = String(searchParams.sort ?? "relevance").trim();
  const page = clamp(Number(searchParams.page ?? "1"), 1, 1000);
  const take = 24;
  const hideSensitive = shouldHideSensitiveInListings(sensitiveMode);

  const where: any = {
    status: "PUBLISHED",
    access: allowAccess,
    ...(hideSensitive ? { isSensitive: false } : {}),
  };
  if (q) {
    where.OR = [{ title: { contains: q } }, { description: { contains: q } }];
  }
  if (tag) where.tags = { some: { tag: { slug: tag } } };
  if (category) where.category = { slug: category };

  const items = await prisma.video.findMany({
    where,
    orderBy: pickOrderBy(sort),
    skip: (page - 1) * take,
    take,
    select: {
      id: true,
      title: true,
      thumbKey: true,
      createdAt: true,
      viewCount: true,
      likeCount: true,
      isSensitive: true,
      channel: { select: { slug: true, name: true } },
      category: { select: { slug: true, name: true } },
    },
  });

  const total = await prisma.video.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <main className="space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">Search</div>
        <div className="small muted mt-1">Task 9: Search & Discovery MVP (title/desc + tag/category filter + sort).</div>

        <form action="/search" method="GET" className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            name="q"
            defaultValue={q}
            placeholder="Tìm kiếm..."
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
          />
          <input
            name="tag"
            defaultValue={tag ?? ""}
            placeholder="Tag slug (optional)"
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
          />
          <input
            name="category"
            defaultValue={category ?? ""}
            placeholder="Category slug (optional)"
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
          />
          <select name="sort" defaultValue={sort} className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
            <option value="relevance">Relevance (MVP)</option>
            <option value="new">New</option>
            <option value="views">Views</option>
            <option value="likes">Likes</option>
          </select>
          <div className="md:col-span-4">
            <button className="btn" type="submit">Search</button>
          </div>
        </form>
      </div>

      <div className="small muted">
        Result: <b>{total}</b> • Page {page}/{totalPages}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => (
          <TrackedVideoLink key={v.id} href={`/v/${v.id}`} videoId={v.id} source="SEARCH" className="card block" placement="search_results">
            <div className="aspect-video overflow-hidden rounded-xl bg-zinc-100">
              <SensitiveThumb
                src={resolveMediaUrl(v.thumbKey)}
                alt={v.title}
                isSensitive={Boolean(v.isSensitive)}
                mode={sensitiveMode as any}
              />
            </div>
            <div className="mt-2 font-semibold line-clamp-2">{v.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {v.viewCount} views • {v.likeCount} likes
              {v.category ? ` • ${v.category.name}` : ""}
              {v.channel ? ` • ${v.channel.name}` : ""}
            </div>
          </TrackedVideoLink>
        ))}
      </div>

      <div className="row" style={{ gap: 10, justifyContent: "center" }}>
        {page > 1 ? (
          <a
            className="btn"
            href={`/search?${new URLSearchParams({ ...searchParams, page: String(page - 1) } as any).toString()}`}
          >
            Prev
          </a>
        ) : null}
        {page < totalPages ? (
          <a
            className="btn"
            href={`/search?${new URLSearchParams({ ...searchParams, page: String(page + 1) } as any).toString()}`}
          >
            Next
          </a>
        ) : null}
      </div>
    </main>
  );
}
