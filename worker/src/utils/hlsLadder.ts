export type LadderRung = { height: number; videoKbps: number; audioKbps: number };

export const DEFAULT_LADDER: LadderRung[] = [
  { height: 1080, videoKbps: 5000, audioKbps: 128 },
  { height: 720, videoKbps: 2800, audioKbps: 128 },
  { height: 480, videoKbps: 1400, audioKbps: 96 },
  { height: 360, videoKbps: 900, audioKbps: 64 },
];

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function parseLadderJson(jsonStr: string | null | undefined): LadderRung[] {
  let ladder: any[] = [];
  try {
    ladder = JSON.parse(jsonStr || "[]");
  } catch {
    ladder = [];
  }

  if (!Array.isArray(ladder) || ladder.length === 0) {
    return DEFAULT_LADDER.slice();
  }

  return ladder
    .filter((x) => x && Number.isFinite(Number(x.height)) && Number.isFinite(Number(x.videoKbps)))
    .map((x) => ({
      height: clampInt(Number(x.height), 144, 2160),
      videoKbps: clampInt(Number(x.videoKbps), 150, 50000),
      audioKbps: clampInt(Number(x.audioKbps ?? 96), 48, 512),
    }))
    .sort((a, b) => b.height - a.height);
}

export function avoidUpscale(ladder: LadderRung[], sourceHeight?: number | null) {
  if (!sourceHeight || sourceHeight <= 0) return ladder;
  const filtered = ladder.filter((r) => r.height <= sourceHeight);
  if (filtered.length > 0) return filtered;
  return [
    {
      height: clampInt(Number(sourceHeight), 144, 2160),
      videoKbps: 1800,
      audioKbps: 96,
    },
  ];
}
