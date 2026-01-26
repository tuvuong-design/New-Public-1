import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveMembershipTier } from "@/lib/membership";
import { getSensitiveModeForUser, shouldHideSensitiveInListings } from "@/lib/sensitive";
import SensitiveThumb from "@/components/sensitive/SensitiveThumb";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { page?: string };
}) {
  const category = await prisma.category.findUnique({ where: { slug: params.slug } });
  if (!category) notFound();

  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const sensitiveMode = await getSensitiveModeForUser(viewerId ?? null);
  const tier = getActiveMembershipTier({
    membershipTier: ((session?.user as any)?.membershipTier ?? "NONE") as any,
    membershipExpiresAt: (session?.user as any)?.membershipExpiresAt ? new Date(((session?.user as any).membershipExpiresAt) as any) : null,
  });
  const allowAccess = tier === "PREMIUM_PLUS" ? ({ in: ["PUBLIC", "PREMIUM_PLUS"] } as const) : ("PUBLIC" as const);

  const page = Math.max(1, Math.min(1000, Number(searchParams.page ?? "1")));
  const take = 24;
  const hideSensitive = shouldHideSensitiveInListings(sensitiveMode);

  const where: any = {
    status: "PUBLISHED",
    access: allowAccess,
    ...(hideSensitive ? { isSensitive: false } : {}),
    categoryId: category.id,
  };

  const items = await prisma.video.findMany({
    where,
    orderBy: [{ createdAt: "desc" as const }],
    skip: (page - 1) * take,
    take,
    select: { id: true, title: true, thumbKey: true, viewCount: true, likeCount: true, isSensitive: true },
  });

  const total = await prisma.video.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <main className="space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">{category.name}</div>
        <div className="small muted mt-1">Browse by category (Task 9).</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn" href="/explore">Explore</a>
          <a className="btn" href={`/search?category=${encodeURIComponent(category.slug)}`}>Search in category</a>
        </div>
      </div>

      <div className="small muted">{total} videos • page {page}/{totalPages}</div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => (
          <a key={v.id} href={`/v/${v.id}`} className="card block">
            <div className="aspect-video overflow-hidden rounded-xl bg-zinc-100">
              <SensitiveThumb src={resolveMediaUrl(v.thumbKey)} alt={v.title} isSensitive={Boolean(v.isSensitive)} mode={sensitiveMode as any} />
            </div>
            <div className="mt-2 font-semibold line-clamp-2">{v.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{v.viewCount} views • {v.likeCount} likes</div>
          </a>
        ))}
      </div>

      <div className="row" style={{ gap: 10, justifyContent: "center" }}>
        {page > 1 ? <a className="btn" href={`/category/${category.slug}?page=${page - 1}`}>Prev</a> : null}
        {page < totalPages ? <a className="btn" href={`/category/${category.slug}?page=${page + 1}`}>Next</a> : null}
      </div>
    </main>
  );
}
