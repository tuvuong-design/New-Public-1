import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/requestIp";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  category: z.string().optional(),
  authorId: z.string().optional(),
  sort: z.enum(["new", "views", "likes"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  take: z.coerce.number().int().min(1).max(50).optional(),
  includeSensitive: z.coerce.boolean().optional(),
});

function pickOrderBy(sort: string | undefined) {
  switch (sort) {
    case "views":
      return [{ viewCount: "desc" as const }, { createdAt: "desc" as const }];
    case "likes":
      return [{ likeCount: "desc" as const }, { createdAt: "desc" as const }];
    case "new":
    default:
      return [{ createdAt: "desc" as const }];
  }
}

function withCors(headers: HeadersInit = {}) {
  return {
    ...headers,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: withCors() });
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`public:videos:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return Response.json({ ok: false, error: "RATE_LIMIT" }, { status: 429, headers: withCors({ "Retry-After": "60" }) });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_QUERY" }, { status: 400, headers: withCors() });
  }

  const { q, tag, category, authorId, sort } = parsed.data;
  const page = parsed.data.page ?? 1;
  const take = parsed.data.take ?? 24;
  const includeSensitive = parsed.data.includeSensitive ?? false;

  const qq = (q ?? "").trim().slice(0, 200);

  const where: any = {
    status: "PUBLISHED",
    access: "PUBLIC",
    ...(includeSensitive ? {} : { isSensitive: false }),
  };

  if (qq) {
    where.OR = [{ title: { contains: qq } }, { description: { contains: qq } }];
  }
  if (tag) {
    where.tags = { some: { tag: { slug: tag } } };
  }
  if (category) {
    where.category = { slug: category };
  }
  if (authorId) {
    where.authorId = authorId;
  }

  const items = await prisma.video.findMany({
    where,
    orderBy: pickOrderBy(sort),
    skip: (page - 1) * take,
    take,
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      durationSec: true,
      viewCount: true,
      likeCount: true,
      commentCount: true,
      isSensitive: true,
      thumbKey: true,
      masterM3u8Key: true,
      author: { select: { id: true, name: true, username: true, image: true } },
      channel: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
      tags: { take: 20, select: { tag: { select: { slug: true, name: true } } } },
    },
  });

  const total = await prisma.video.count({ where });

  const mapped = items.map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    createdAt: v.createdAt,
    durationSec: v.durationSec,
    viewCount: v.viewCount,
    likeCount: v.likeCount,
    commentCount: v.commentCount,
    isSensitive: v.isSensitive,
    watchUrl: `/v/${v.id}`,
    thumbUrl: resolveMediaUrl(v.thumbKey) ?? null,
    hlsUrl: resolveMediaUrl(v.masterM3u8Key) ?? null,
    author: v.author,
    channel: v.channel,
    category: v.category,
    tags: v.tags.map((t) => t.tag),
  }));

  return Response.json(
    {
      ok: true,
      page,
      take,
      total,
      items: mapped,
    },
    {
      headers: withCors({
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "X-RateLimit-Remaining": String(rl.remaining),
      }),
    },
  );
}
