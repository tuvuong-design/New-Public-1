import { describe, expect, it } from "vitest";
import { DEFAULT_LADDER, avoidUpscale, parseLadderJson } from "../worker/src/utils/hlsLadder";

describe("worker hls ladder helpers", () => {
  it("fallbacks to DEFAULT_LADDER on invalid JSON", () => {
    const ladder = parseLadderJson("not-json");
    expect(ladder).toHaveLength(DEFAULT_LADDER.length);
    expect(ladder[0].height).toBe(1080);
  });

  it("sorts ladder high -> low", () => {
    const ladder = parseLadderJson(JSON.stringify([
      { height: 360, videoKbps: 900, audioKbps: 64 },
      { height: 1080, videoKbps: 5000, audioKbps: 128 },
      { height: 720, videoKbps: 2800, audioKbps: 128 },
    ]));
    expect(ladder.map((x) => x.height)).toEqual([1080, 720, 360]);
  });

  it("avoidUpscale removes rungs higher than source height", () => {
    const ladder = avoidUpscale(DEFAULT_LADDER, 720);
    expect(ladder.map((x) => x.height)).toEqual([720, 480, 360]);
  });
});
