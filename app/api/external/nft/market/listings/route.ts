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
  status: z.enum(["ACTIVE","SOLD","CANCELLED"]).optional(),
  collectionId: z.string().optional(),
  sellerId: z.string().optional(),
});

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["NFT_READ","PUBLIC_READ","VIDEO_READ"] });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function GET(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["NFT_READ","PUBLIC_READ"] });
  if (!g.ok) return g.res;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return withCors(jsonError(400, "Query không hợp lệ", parsed.error.flatten()), g.origin);

  const { page, take, status, collectionId, sellerId } = parsed.data;
  const where: any = {};
  if (status) where.status = status;
  else where.status = "ACTIVE";
  if (sellerId) where.sellerId = sellerId;
  if (collectionId) where.item = { collectionId };

  const [total, rows] = await prisma.$transaction([
    prisma.nftListing.count({ where }),
    prisma.nftListing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        seller: { select: { id: true, username: true, name: true, image: true } },
        item: {
          include: {
            collection: { select: { id: true, title: true, imageKey: true, creatorId: true } },
            owner: { select: { id: true, username: true, name: true, image: true } },
          },
        },
      },
    }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    status: r.status,
    priceStars: r.priceStars,
    createdAt: r.createdAt,
    soldAt: r.soldAt,
    seller: {
      id: r.seller.id,
      username: r.seller.username,
      name: r.seller.name,
      image: resolveMediaUrl(r.seller.image),
    },
    item: {
      id: r.item.id,
      name: r.item.name,
      description: r.item.description,
      imageUrl: resolveMediaUrl(r.item.imageKey),
      animationUrl: r.item.animationUrl,
      verificationStatus: r.item.verificationStatus,
      createdAt: r.item.createdAt,
      owner: {
        id: r.item.owner.id,
        username: r.item.owner.username,
        name: r.item.owner.name,
        image: resolveMediaUrl(r.item.owner.image),
      },
      collection: {
        id: r.item.collection.id,
        title: r.item.collection.title,
        imageUrl: resolveMediaUrl(r.item.collection.imageKey),
        creatorId: r.item.collection.creatorId,
      },
    },
  }));

  return withCors(NextResponse.json({ ok: true, page, take, total, data }), g.origin);
}
