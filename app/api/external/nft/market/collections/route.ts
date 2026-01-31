import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export const runtime = "nodejs";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  take: z.coerce.number().int().min(1).max(50).default(24),
  creatorId: z.string().optional(),
  q: z.string().optional(),
});

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["NFT_READ","PUBLIC_READ"] });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function GET(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["NFT_READ","PUBLIC_READ"] });
  if (!g.ok) return g.res;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return withCors(jsonError(400, "Query không hợp lệ", parsed.error.flatten()), g.origin);

  const { page, take, creatorId, q } = parsed.data;

  const where: any = {};
  if (creatorId) where.creatorId = creatorId;
  if (q) where.title = { contains: q, mode: "insensitive" };

  const [total, rows] = await prisma.$transaction([
    prisma.nftCollection.count({ where }),
    prisma.nftCollection.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        creator: { select: { id: true, username: true, name: true, image: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const ids = rows.map(r => r.id);
  const floorByCollection: Record<string, number | null> = {};
  if (ids.length) {
    const activeListings = await prisma.nftListing.findMany({
      where: { status: "ACTIVE", item: { collectionId: { in: ids } } } as any,
      select: { priceStars: true, item: { select: { collectionId: true } } },
    });
    for (const l of activeListings) {
      const cid = (l as any).item.collectionId as string;
      const price = l.priceStars;
      const cur = floorByCollection[cid];
      floorByCollection[cid] = cur == null ? price : Math.min(cur, price);
    }
    for (const cid of ids) {
      if (!(cid in floorByCollection)) floorByCollection[cid] = null;
    }
  }

  const data = rows.map((c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    imageUrl: resolveMediaUrl(c.imageKey),
    creator: {
      id: c.creator.id,
      username: c.creator.username,
      name: c.creator.name,
      image: resolveMediaUrl(c.creator.image),
    },
    royaltyBps: c.royaltyBps,
    creatorRoyaltySharePct: c.creatorRoyaltySharePct,
    createdAt: c.createdAt,
    itemCount: c._count?.items ?? 0,
    floorPriceStars: floorByCollection[c.id] ?? null,
  }));

  return withCors(NextResponse.json({ ok: true, page, take, total, data }), g.origin);
}
