export const SIMILAR_WEIGHTS = {
  channel: 5,
  category: 2,
  tagOverlap: 1.5,
  fullText: 1,
} as const;

export type SimilarSignals = {
  ftScore: number;
  tagOverlap: number;
  catMatch: boolean;
  chanMatch: boolean;
};

export function computeSimilarScore(
  s: SimilarSignals,
  weights: typeof SIMILAR_WEIGHTS = SIMILAR_WEIGHTS
) {
  return (
    (s.chanMatch ? 1 : 0) * weights.channel +
    (s.catMatch ? 1 : 0) * weights.category +
    s.tagOverlap * weights.tagOverlap +
    s.ftScore * weights.fullText
  );
}
