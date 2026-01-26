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
  sort: z.enum(["relevance", "new", "views", "likes"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  take: z.coerce.number().int().min(1).max(50).optional(),
  includeSensitive: z.coerce.boolean().optional(),
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
      return [{ viewCount: "desc" as const }, { createdAt: "desc" as const }];
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
  const rl = await rateLimit(`public:search:${ip}`, 180, 60_000);
  if (!rl.ok) {
    return Response.json({ ok: false, error: "RATE_LIMIT" }, { status: 429, headers: withCors({ "Retry-After": "60" }) });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_QUERY" }, { status: 400, headers: withCors() });

  const { q, tag, category, sort } = parsed.data;
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

  const list = await prisma.video.findMany({
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
      author: { select: { id: true, name: true, username: true } },
      channel: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  const total = await prisma.video.count({ where });

  return Response.json(
    {
      ok: true,
      page,
      take,
      total,
      items: list.map((v) => ({
        ...v,
        watchUrl: `/v/${v.id}`,
        thumbUrl: resolveMediaUrl(v.thumbKey) ?? null,
      })),
    },
    {
      headers: withCors({
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "X-RateLimit-Remaining": String(rl.remaining),
      }),
    },
  );
}
