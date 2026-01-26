import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIMILAR_WEIGHTS } from "@/lib/videos/similarScoring";
import { env } from "@/lib/env";
import { getSimilarVideosFromCache, setSimilarVideosCache } from "@/lib/videos/similarCache";

export type SimilarVideoDebug = {
  score: number;
  ftScore: number;
  tagOverlap: number;
  catMatch: number;
  chanMatch: number;
};

export type SimilarVideo = {
  id: string;
  title: string;
  thumbKey: string | null;
  isSensitive: boolean;
  createdAt: Date;
  channel: { id: string; name: string; slug: string } | null;
  author: { id: string; name: string | null; email: string | null } | null;
  _similar: SimilarVideoDebug;
};

/**
 * Advanced similar videos ranking.
 *
 * Requirements (per spec):
 * - Tags overlap
 * - Category match
 * - Full-text ranking (MySQL MATCH ... AGAINST)
 * - Exclude current video
 * - Prefer same channel
 */
export async function getSimilarVideosAdvanced(
  videoId: string,
  {
    take = 12,
    maxCandidates = 150,
  }: {
    take?: number;
    maxCandidates?: number;
  } = {}
): Promise<SimilarVideo[]> {
  // Redis cache (keyed by videoId).
  // We cache a larger list and slice to requested `take`.
  const cached = await getSimilarVideosFromCache(videoId);
  if (cached) {
    return cached.slice(0, take);
  }

  const requestedTake = take;
  const takeForCompute = Math.max(requestedTake, env.SIMILAR_CACHE_MAX_ITEMS ?? 50);

  const current = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      title: true,
      description: true,
      channelId: true,
      categoryId: true,
      tags: { select: { tagId: true, tag: { select: { slug: true, name: true } } } },
    },
  });

  if (!current) return [];

  const tagIds = current.tags.map((t) => t.tagId);
  const tagTokens = current.tags
    .map((t) => t.tag.slug || t.tag.name)
    .filter(Boolean)
    .slice(0, 12);

  // Build a reasonable full-text query.
  // We purposely keep it short to avoid weird MATCH behavior with very long strings.
  const query = `${current.title} ${tagTokens.join(" ")}`.trim().slice(0, 220);

  // If no tags: use a dummy value to keep the SQL valid.
  const tagIdsOrDummy = tagIds.length ? tagIds : ["__none__"];
  const channelId = current.channelId || "__none__";
  const categoryId = current.categoryId || "__none__";

  type Row = {
    id: string;
    score: number;
    ftScore: number;
    tagOverlap: number;
    catMatch: number;
    chanMatch: number;
  };

  // Weights — tuneable.
  const W_CHAN = SIMILAR_WEIGHTS.channel;
  const W_CAT = SIMILAR_WEIGHTS.category;
  const W_TAG = SIMILAR_WEIGHTS.tagOverlap;
  const W_FT = SIMILAR_WEIGHTS.fullText;

  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT
      v.id,
      (
        (CASE WHEN v.channelId = ${channelId} THEN 1 ELSE 0 END) * ${W_CHAN}
        + (CASE WHEN v.categoryId = ${categoryId} THEN 1 ELSE 0 END) * ${W_CAT}
        + (COUNT(DISTINCT vt.tagId) * ${W_TAG})
        + (MATCH(v.title, v.description) AGAINST (${query} IN NATURAL LANGUAGE MODE) * ${W_FT})
      ) AS score,
      MATCH(v.title, v.description) AGAINST (${query} IN NATURAL LANGUAGE MODE) AS ftScore,
      COUNT(DISTINCT vt.tagId) AS tagOverlap,
      (CASE WHEN v.categoryId = ${categoryId} THEN 1 ELSE 0 END) AS catMatch,
      (CASE WHEN v.channelId = ${channelId} THEN 1 ELSE 0 END) AS chanMatch
    FROM Video v
    LEFT JOIN VideoTag vt
      ON vt.videoId = v.id
      AND vt.tagId IN (${Prisma.join(tagIdsOrDummy)})
    WHERE v.status = 'PUBLISHED'
      AND v.id <> ${videoId}
    GROUP BY v.id
    HAVING score > 0
    ORDER BY score DESC, v.createdAt DESC
    LIMIT ${maxCandidates};
  `);

  const ids = rows.map((r) => r.id);

  const videos = ids.length
    ? await prisma.video.findMany({
        where: { id: { in: ids } },
        include: {
          channel: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true, email: true } },
        },
      })
    : [];

  const byId = new Map(videos.map((v) => [v.id, v]));
  const debugById = new Map(rows.map((r) => [r.id, r]));

  const out: SimilarVideo[] = [];
  for (const id of ids) {
    const v = byId.get(id);
    const dbg = debugById.get(id);
    if (!v || !dbg) continue;
    out.push({
      id: v.id,
      title: v.title,
      thumbKey: v.thumbKey,
      isSensitive: Boolean((v as any).isSensitive),
      createdAt: v.createdAt,
      channel: v.channel,
      author: v.author,
      _similar: {
        score: Number(dbg.score) || 0,
        ftScore: Number(dbg.ftScore) || 0,
        tagOverlap: Number(dbg.tagOverlap) || 0,
        catMatch: Number(dbg.catMatch) || 0,
        chanMatch: Number(dbg.chanMatch) || 0,
      },
    });
    if (out.length >= takeForCompute) break;
  }

  // Fallback fill (best-effort) to always show something.
  if (out.length < takeForCompute) {
    const remaining = takeForCompute - out.length;
    const picked = new Set([videoId, ...out.map((x) => x.id)]);

    // 1) same channel
    if (current.channelId) {
      const more = await prisma.video.findMany({
        where: { status: "PUBLISHED", channelId: current.channelId, id: { notIn: Array.from(picked) } },
        orderBy: { createdAt: "desc" },
        take: remaining,
        include: {
          channel: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true, email: true } },
        },
      });
      for (const v of more) {
        picked.add(v.id);
        out.push({
          id: v.id,
          title: v.title,
          thumbKey: v.thumbKey,
          isSensitive: Boolean((v as any).isSensitive),
          createdAt: v.createdAt,
          channel: v.channel,
          author: v.author,
          _similar: { score: 0, ftScore: 0, tagOverlap: 0, catMatch: 0, chanMatch: 1 },
        });
      }
    }

    // 2) same category
    if (out.length < takeForCompute && current.categoryId) {
      const remaining2 = takeForCompute - out.length;
      const more = await prisma.video.findMany({
        where: { status: "PUBLISHED", categoryId: current.categoryId, id: { notIn: Array.from(picked) } },
        orderBy: { createdAt: "desc" },
        take: remaining2,
        include: {
          channel: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true, email: true } },
        },
      });
      for (const v of more) {
        picked.add(v.id);
        out.push({
          id: v.id,
          title: v.title,
          thumbKey: v.thumbKey,
          isSensitive: Boolean((v as any).isSensitive),
          createdAt: v.createdAt,
          channel: v.channel,
          author: v.author,
          _similar: { score: 0, ftScore: 0, tagOverlap: 0, catMatch: 1, chanMatch: 0 },
        });
      }
    }

    // 3) latest
    if (out.length < takeForCompute) {
      const remaining3 = takeForCompute - out.length;
      const more = await prisma.video.findMany({
        where: { status: "PUBLISHED", id: { notIn: Array.from(picked) } },
        orderBy: { createdAt: "desc" },
        take: remaining3,
        include: {
          channel: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true, email: true } },
        },
      });
      for (const v of more) {
        picked.add(v.id);
        out.push({
          id: v.id,
          title: v.title,
          thumbKey: v.thumbKey,
          isSensitive: Boolean((v as any).isSensitive),
          createdAt: v.createdAt,
          channel: v.channel,
          author: v.author,
          _similar: { score: 0, ftScore: 0, tagOverlap: 0, catMatch: 0, chanMatch: 0 },
        });
      }
    }
  }

  // Store to cache (best-effort). Even if caching fails, we still return computed result.
  await setSimilarVideosCache(videoId, out);

  return out.slice(0, requestedTake);
}
