import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getActiveMembershipTier } from "@/lib/membership";
import { getSensitiveModeForUser, shouldHideSensitiveInListings } from "@/lib/sensitive";
import { recordSearchQuery } from "@/lib/search/trending";
import { redisGetJSON, redisSetJSON } from "@/lib/redis";
import { sha256Hex } from "@/lib/hash";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(["relevance", "new", "views", "likes"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  take: z.coerce.number().int().min(1).max(50).optional(),
});

function pickOrderBy(sort: string | undefined) {
  switch (sort) {
    case "new":
      return [{ createdAt: "desc" as const }];
    case "views":
      return [{ viewCount: "desc" as const }, { createdAt: "desc" as const }];
    case "likes":
      return [{ likeCount: "desc" as const }, { createdAt: "desc" as const }];
    default:
      // Relevance MVP: order by views; full-text ranking is implemented in lib/videos/similar.
      return [{ viewCount: "desc" as const }, { createdAt: "desc" as const }];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_QUERY" }, { status: 400 });

  const { q, tag, category, sort } = parsed.data;
  const page = parsed.data.page ?? 1;
  const take = parsed.data.take ?? 24;

  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;

  const viewerMem = {
    membershipTier: ((session?.user as any)?.membershipTier ?? "NONE") as any,
    membershipExpiresAt: (session?.user as any)?.membershipExpiresAt
      ? new Date(((session?.user as any).membershipExpiresAt) as any)
      : null,
  };
  const tier = getActiveMembershipTier(viewerMem);
  const allowedAccess = tier === "PREMIUM_PLUS" ? (["PUBLIC", "PREMIUM_PLUS"] as const) : (["PUBLIC"] as const);
  const allowAccess = tier === "PREMIUM_PLUS" ? ({ in: allowedAccess } as const) : ("PUBLIC" as const);

  const sensitiveMode = await getSensitiveModeForUser(viewerId ?? null);
  const hideSensitive = shouldHideSensitiveInListings(sensitiveMode);

  const qq = (q ?? "").trim().slice(0, 200);

  // Best-effort hot-query cache (Redis). Keep TTL short to avoid stale listings.
  const cacheKey = `videoshare:search:cache:v1:${sha256Hex(JSON.stringify({ q: qq, tag, category, sort, page, take, allowAccess, hideSensitive }))}`;
  const cached = await redisGetJSON<any>(cacheKey);
  if (cached) return Response.json(cached);
  const where: any = {
    status: "PUBLISHED",
    access: allowAccess,
    ...(hideSensitive ? { isSensitive: false } : {}),
  };

  if (qq) {
    where.OR = [
      { title: { contains: qq } },
      { description: { contains: qq } },
    ];
  }

  if (tag) {
    where.tags = { some: { tag: { slug: tag } } };
  }

  if (category) {
    where.category = { slug: category };
  }

  // Record trending queries best-effort (do not block search).
  if (qq) recordSearchQuery(qq).catch(() => {});

  // Use MySQL FULLTEXT when available for better relevance.
  let list: any[] = [];
  let total = 0;

  const useFulltext = qq.length >= 3 && sort === "relevance";
  if (useFulltext) {
    // In NATURAL LANGUAGE MODE; fallback to contains if MATCH fails.
    try {
      const ids = await prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
        SELECT v.id
        FROM Video v
        WHERE v.status = 'PUBLISHED'
          AND v.access IN (${Prisma.join([...allowedAccess])})
          ${hideSensitive ? Prisma.sql`AND v.isSensitive = 0` : Prisma.empty}
          AND MATCH(v.title, v.description) AGAINST (${qq} IN NATURAL LANGUAGE MODE)
        ORDER BY MATCH(v.title, v.description) AGAINST (${qq} IN NATURAL LANGUAGE MODE) DESC, v.viewCount DESC, v.createdAt DESC
        LIMIT ${take} OFFSET ${(page - 1) * take}
      `,
      );

      const idList = ids.map((r) => r.id);
      if (idList.length) {
        const rows = await prisma.video.findMany({
          where: { id: { in: idList } },
          select: {
            id: true,
            title: true,
            thumbKey: true,
            createdAt: true,
            viewCount: true,
            likeCount: true,
            isSensitive: true,
            author: { select: { id: true, name: true, email: true } },
            channel: { select: { id: true, name: true, slug: true } },
            category: { select: { id: true, name: true, slug: true } },
          },
        });
        const byId = new Map(rows.map((r) => [r.id, r] as const));
        list = idList.map((id) => byId.get(id)).filter(Boolean) as any[];
      }

      // Total for fulltext: approximate with count MATCH (can be slow; keep it optional)
      total = await prisma.video.count({ where });
    } catch {
      // fall back to contains
    }
  }

  if (!list.length) {
    list = await prisma.video.findMany({
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
        author: { select: { id: true, name: true, email: true } },
        channel: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    total = await prisma.video.count({ where });
  }

  const payload = {
    ok: true,
    page,
    take,
    total,
    items: list,
  };

  await redisSetJSON(cacheKey, payload, 60);
  return Response.json(payload);
}
