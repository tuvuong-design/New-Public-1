import { prisma } from "@/lib/prisma";
import { getStorageConfigShape, joinUrl, normalizeBasePath } from "@/lib/storage/config";

export async function resolveHlsMasterUrl(videoId: string, masterM3u8Key: string) {
  const key = String(masterM3u8Key || "").trim();
  if (!key) return "";

  const cfg = await getStorageConfigShape();
  const asset = await prisma.videoAsset.findUnique({ where: { videoId } });
  const status = (asset?.healthStatus || "UNKNOWN") as any;

  // If R2/CDN is degraded/down, prefer FTP HLS fallback.
  if (cfg.ftpHls.enabled && cfg.ftpHls.publicBaseUrl && (status === "DEGRADED" || status === "DOWN")) {
    const basePath = normalizeBasePath(cfg.ftpHls.basePath);
    return joinUrl(cfg.ftpHls.publicBaseUrl, basePath, key);
  }

  // Default: R2 public.
  const r2Base = String(process.env.R2_PUBLIC_BASE_URL || "").trim();
  if (!r2Base) return key;
  return joinUrl(r2Base, key);
}
