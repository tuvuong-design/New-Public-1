import { prisma } from "@/lib/prisma";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/requestIp";

export const runtime = "nodejs";

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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`public:video:${ip}`, 240, 60_000);
  if (!rl.ok) {
    return Response.json({ ok: false, error: "RATE_LIMIT" }, { status: 429, headers: withCors({ "Retry-After": "60" }) });
  }

  const url = new URL(req.url);
  const includeSensitive = url.searchParams.get("includeSensitive") === "1";

  const v = await prisma.video.findFirst({
    where: {
      id: params.id,
      status: "PUBLISHED",
      access: "PUBLIC",
      ...(includeSensitive ? {} : { isSensitive: false }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      durationSec: true,
      width: true,
      height: true,
      viewCount: true,
      likeCount: true,
      commentCount: true,
      shareCount: true,
      starCount: true,
      giftCount: true,
      isSensitive: true,
      thumbKey: true,
      previewKey: true,
      masterM3u8Key: true,
      author: { select: { id: true, name: true, username: true, image: true } },
      channel: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
      tags: { take: 50, select: { tag: { select: { slug: true, name: true } } } },
      chapters: { orderBy: { startSec: "asc" }, select: { startSec: true, title: true } },
      subtitles: { select: { lang: true, vttKey: true, provider: true } },
    },
  });

  if (!v) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: withCors() });
  }

  return Response.json(
    {
      ok: true,
      video: {
        id: v.id,
        title: v.title,
        description: v.description,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        durationSec: v.durationSec,
        width: v.width,
        height: v.height,
        counts: {
          views: v.viewCount,
          likes: v.likeCount,
          comments: v.commentCount,
          shares: v.shareCount,
          stars: v.starCount,
          gifts: v.giftCount,
        },
        isSensitive: v.isSensitive,
        watchUrl: `/v/${v.id}`,
        thumbUrl: resolveMediaUrl(v.thumbKey) ?? null,
        previewUrl: resolveMediaUrl(v.previewKey) ?? null,
        hlsUrl: resolveMediaUrl(v.masterM3u8Key) ?? null,
        author: v.author,
        channel: v.channel,
        category: v.category,
        tags: v.tags.map((t) => t.tag),
        chapters: v.chapters,
        subtitles: v.subtitles.map((s) => ({ ...s, vttUrl: resolveMediaUrl(s.vttKey) })),
      },
    },
    {
      headers: withCors({
        "Cache-Control": "public, max-age=30, s-maxage=120",
        "X-RateLimit-Remaining": String(rl.remaining),
      }),
    },
  );
}
