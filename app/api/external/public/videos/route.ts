import { NextRequest, NextResponse } from "next/server";
import { withCors } from "@/lib/api/cors";
import { guardExternal } from "@/lib/api/externalGuards";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { rateLimit, ipKey } from "@/lib/api/rateLimit";
import { jsonError } from "@/lib/api/errors";

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

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: "PUBLIC_READ" });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function GET(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["PUBLIC_READ","VIDEO_READ"] });
  if (!g.ok) return g.res;

  const rl = await rateLimit(req, { key: `rl:ext:videos:${ipKey(req)}:${g.apiKey.id}`, limit: 240, windowSec: 60 });
  if (!rl.ok) return withCors(jsonError(429, "Rate limit exceeded"), g.origin);

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()));
  if (!parsed.success) return withCors(jsonError(400, "Invalid query", parsed.error.flatten()), g.origin);

  const { q, tag, category, authorId, sort } = parsed.data;
  const page = parsed.data.page ?? 1;
  const take = parsed.data.take ?? 24;
  const includeSensitive = parsed.data.includeSensitive ?? false;

  const where: any = {
    status: "PUBLISHED",
    deletedAt: null,
    access: "PUBLIC",
    ...(includeSensitive ? {} : { isSensitive: false }),
    ...(authorId ? { authorId } : {}),
    ...(category ? { category: { name: category } } : {}),
    ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { channel: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.video.findMany({
      where,
      orderBy: pickOrderBy(sort),
      skip: (page - 1) * take,
      take,
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        durationSec: true,
        width: true,
        height: true,
        thumbKey: true,
        previewKey: true,
        channel: { select: { id: true, name: true, avatarKey: true } },
        author: { select: { id: true, name: true } },
      },
    }),
    prisma.video.count({ where }),
  ]);

  const videos = items.map((v) => ({
    ...v,
    thumbUrl: v.thumbKey ? resolveMediaUrl(v.thumbKey) : null,
    previewUrl: v.previewKey ? resolveMediaUrl(v.previewKey) : null,
    channel: v.channel ? { ...v.channel, avatarUrl: v.channel.avatarKey ? resolveMediaUrl(v.channel.avatarKey) : null } : null,
  }));

  return withCors(NextResponse.json({ ok: true, page, take, total, videos }), g.origin);
}
