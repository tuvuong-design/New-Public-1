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
  collectionId: z.string().optional(),
  ownerId: z.string().optional(),
  q: z.string().optional(),
  includeListing: z.coerce.boolean().optional(),
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

  const { page, take, collectionId, ownerId, q, includeListing } = parsed.data;

  const where: any = {};
  if (collectionId) where.collectionId = collectionId;
  if (ownerId) where.ownerId = ownerId;
  if (q) where.name = { contains: q, mode: "insensitive" };

  const [total, rows] = await prisma.$transaction([
    prisma.nftItem.count({ where }),
    prisma.nftItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        collection: { select: { id: true, title: true, imageKey: true, creatorId: true } },
        owner: { select: { id: true, username: true, name: true, image: true } },
        ...(includeListing ? { listings: { where: { status: "ACTIVE" }, take: 1, orderBy: { createdAt: "desc" } } } : {}),
      } as any,
    }),
  ]);

  const data = rows.map((it: any) => ({
    id: it.id,
    name: it.name,
    description: it.description,
    imageUrl: resolveMediaUrl(it.imageKey),
    animationUrl: it.animationUrl,
    verificationStatus: it.verificationStatus,
    exportStatus: it.exportStatus,
    exportChain: it.exportChain,
    marketplaceFrozen: it.marketplaceFrozen,
    createdAt: it.createdAt,
    owner: {
      id: it.owner.id,
      username: it.owner.username,
      name: it.owner.name,
      image: resolveMediaUrl(it.owner.image),
    },
    collection: {
      id: it.collection.id,
      title: it.collection.title,
      imageUrl: resolveMediaUrl(it.collection.imageKey),
      creatorId: it.collection.creatorId,
    },
    activeListing: it.listings?.[0] ? {
      id: it.listings[0].id,
      priceStars: it.listings[0].priceStars,
      createdAt: it.listings[0].createdAt,
    } : null,
  }));

  return withCors(NextResponse.json({ ok: true, page, take, total, data }), g.origin);
}
