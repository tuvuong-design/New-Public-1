import { env } from "@/lib/env";
import { redisDel, redisGetJSON, redisSetJSON } from "@/lib/redis";
import type { SimilarVideo } from "./similar";

/**
 * Redis cache for Similar Videos.
 *
 * Keyed by videoId (per requirement), storing a list of top-N similar videos.
 *
 * Invalidation strategy
 * - Explicit delete on admin update of: title, category, tags (and description).
 * - TTL as an additional safety net.
 */

export const SIMILAR_CACHE_KEY_PREFIX = "videoshare:similar:v1:";

export type SimilarVideosCachePayload = {
  v: 1;
  generatedAt: number; // epoch ms
  items: Array<
    Omit<SimilarVideo, "createdAt"> & {
      createdAt: number;
    }
  >;
};

export function similarCacheKey(videoId: string) {
  return `${SIMILAR_CACHE_KEY_PREFIX}${videoId}`;
}

export async function getSimilarVideosFromCache(videoId: string): Promise<SimilarVideo[] | null> {
  const payload = await redisGetJSON<SimilarVideosCachePayload>(similarCacheKey(videoId));
  if (!payload || payload.v !== 1 || !Array.isArray(payload.items)) return null;

  // Re-hydrate Date.
  return payload.items.map((it) => ({
    ...it,
    createdAt: new Date(it.createdAt),
  }));
}

export async function setSimilarVideosCache(videoId: string, items: SimilarVideo[]) {
  const ttl = env.SIMILAR_CACHE_TTL_SECONDS ?? 900;
  const maxItems = env.SIMILAR_CACHE_MAX_ITEMS ?? 50;

  const payload: SimilarVideosCachePayload = {
    v: 1,
    generatedAt: Date.now(),
    items: items.slice(0, maxItems).map((it) => ({
      ...it,
      createdAt: it.createdAt.getTime(),
    })),
  };

  await redisSetJSON(similarCacheKey(videoId), payload, ttl);
}

export async function invalidateSimilarVideosCache(videoId: string) {
  await redisDel(similarCacheKey(videoId));
}
