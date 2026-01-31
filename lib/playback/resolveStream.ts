import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getStorageConfigShape, joinUrl, normalizeBasePath } from "@/lib/storage/config";

export type StreamOrigin = "R2_A" | "R2_B" | "R2" | "FTP_HLS";

export type StreamCandidate = {
  url: string;
  origin: StreamOrigin;
};

function stableBucket0to99(input: string): number {
  // Stable hash bucket for consistent A/B routing
  const buf = crypto.createHash("sha256").update(input).digest();
  const n = (buf[0] << 8) + buf[1];
  return n % 100;
}

function pickPreferA(args: { videoId: string; viewerId?: string | null; hasAB: boolean; splitPercent: number }): boolean {
  if (!args.hasAB) return true;

  const split = Number.isFinite(args.splitPercent) ? Math.max(0, Math.min(100, args.splitPercent)) : 50;

  // If we don't have viewerId, keep deterministic by videoId only
  const bucket = stableBucket0to99(`r2ab:${args.viewerId || "anon"}:${args.videoId}`);
  return bucket < split;
}

export async function resolveStreamCandidates(args: {
  videoId: string;
  masterM3u8Key: string;
  viewerId?: string | null;
}): Promise<{ candidates: StreamCandidate[]; preferred: StreamCandidate | null; healthStatus: string }> {
  const key = String(args.masterM3u8Key || "").trim();
  if (!key) return { candidates: [], preferred: null, healthStatus: "UNKNOWN" };

  const cfg = await getStorageConfigShape();
  const asset = await prisma.videoAsset.findUnique({ where: { videoId: args.videoId } });
  const status = String(asset?.healthStatus || "UNKNOWN");

  const candidates: StreamCandidate[] = [];

  // R2 bases (A/B preferred, fallback to single base). DB config overrides env.
  const baseDefault = String(env.R2_PUBLIC_BASE_URL || "").trim();
  const cfgA = String(cfg.r2Playback?.publicBaseUrlA || "").trim();
  const cfgB = String(cfg.r2Playback?.publicBaseUrlB || "").trim();
  const baseA = cfgA || String(env.R2_PUBLIC_BASE_URL_A || "").trim() || baseDefault;
  const baseB = cfgB || String(env.R2_PUBLIC_BASE_URL_B || "").trim();

  const hasAB = Boolean(baseA && baseB);
  const splitPercent = Number.isFinite(Number(cfg.r2Playback?.abSplitPercent)) ? Number(cfg.r2Playback.abSplitPercent) : Number(env.R2_AB_SPLIT_PERCENT ?? 50);
  const preferA = pickPreferA({ videoId: args.videoId, viewerId: args.viewerId, hasAB, splitPercent });

  const r2First = preferA ? baseA : (baseB || baseA);
  const r2Second = preferA ? (baseB || null) : (baseA || null);

  if (r2First) candidates.push({ url: joinUrl(r2First, key), origin: hasAB ? (preferA ? "R2_A" : "R2_B") : "R2" });
  if (r2Second && r2Second !== r2First) {
    candidates.push({ url: joinUrl(r2Second, key), origin: preferA ? "R2_B" : "R2_A" });
  }

  // FTP mirror fallback
  if (cfg.ftpHls.enabled && cfg.ftpHls.publicBaseUrl) {
    const basePath = normalizeBasePath(cfg.ftpHls.basePath);
    candidates.push({ url: joinUrl(cfg.ftpHls.publicBaseUrl, basePath, key), origin: "FTP_HLS" });
  }

  // Prefer FTP first if degraded/down
  if ((status === "DEGRADED" || status === "DOWN") && candidates.some((c) => c.origin === "FTP_HLS")) {
    candidates.sort((a, b) => {
      const wa = a.origin === "FTP_HLS" ? 0 : 1;
      const wb = b.origin === "FTP_HLS" ? 0 : 1;
      return wa - wb;
    });
  }

  return { candidates, preferred: candidates[0] ?? null, healthStatus: status };
}
