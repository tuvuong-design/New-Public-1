import { describe, expect, it } from "vitest";
import { computeSimilarScore, SIMILAR_WEIGHTS } from "@/lib/videos/similarScoring";

describe("computeSimilarScore", () => {
  it("computes score with default weights", () => {
    const score = computeSimilarScore({
      ftScore: 2,
      tagOverlap: 3,
      catMatch: true,
      chanMatch: false,
    });

    // cat=2, tag=3*1.5=4.5, ft=2*1 => total=8.5
    expect(score).toBeCloseTo(8.5, 6);
  });

  it("prioritizes same channel", () => {
    const a = computeSimilarScore({
      ftScore: 0,
      tagOverlap: 0,
      catMatch: false,
      chanMatch: true,
    });

    const b = computeSimilarScore({
      ftScore: 1.1,
      tagOverlap: 1,
      catMatch: true,
      chanMatch: false,
    });

    expect(a).toBeGreaterThan(b);
    expect(a).toBe(SIMILAR_WEIGHTS.channel);
  });
});
