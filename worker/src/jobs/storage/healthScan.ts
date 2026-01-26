import { prisma } from "../../prisma";
import { headObject } from "../../utils/r2io";
import { decryptSecret, getStorageShape, normalizeBasePath } from "../../storage/config";
import { withFtp, ftpExists } from "../../storage/ftp";
import { storageQueue } from "../../queues";

async function checkFtpHlsExists(cfg: any, remoteKey: string): Promise<boolean> {
  if (!cfg?.ftpHls?.enabled || !cfg.ftpHls.secretId) return false;
  const sec = await decryptSecret<{ password: string }>(cfg.ftpHls.secretId);
  const password = sec?.password || "";
  if (!password) return false;
  const base = normalizeBasePath(cfg.ftpHls.basePath);
  const remotePath = [base, remoteKey].filter(Boolean).join("/");
  return withFtp({ host: cfg.ftpHls.host, port: cfg.ftpHls.port, username: cfg.ftpHls.username, password }, async (client) => {
    return ftpExists(client, remotePath);
  });
}

export async function storageHealthScanJob(args?: { limit?: number }) {
  const cfg = await getStorageShape();
  const limit = Math.max(10, Math.min(500, Number(args?.limit || 200)));

  const videos = await prisma.video.findMany({
    where: { masterM3u8Key: { not: null } },
    select: { id: true, masterM3u8Key: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  let ok = 0, degraded = 0, down = 0;

  for (const v of videos) {
    const key = v.masterM3u8Key || "";
    if (!key) continue;

    const r2Ok = await headObject(key);
    if (r2Ok) {
      ok += 1;
      await prisma.videoAsset.upsert({
        where: { videoId: v.id },
        create: { videoId: v.id, healthStatus: "OK" as any, lastHealthCheckedAt: new Date() },
        update: { healthStatus: "OK" as any, lastHealthCheckedAt: new Date() },
      });
      continue;
    }

    const ftpOk = await checkFtpHlsExists(cfg, key);
    if (ftpOk) {
      degraded += 1;
      await prisma.videoAsset.upsert({
        where: { videoId: v.id },
        create: { videoId: v.id, healthStatus: "DEGRADED" as any, lastHealthCheckedAt: new Date() },
        update: { healthStatus: "DEGRADED" as any, lastHealthCheckedAt: new Date() },
      });
      continue;
    }

    down += 1;
    const asset = await prisma.videoAsset.upsert({
      where: { videoId: v.id },
      create: { videoId: v.id, healthStatus: "DOWN" as any, lastHealthCheckedAt: new Date() },
      update: { healthStatus: "DOWN" as any, lastHealthCheckedAt: new Date() },
    });

    // Attempt rebuild if Drive has origin backup.
    if (cfg.drive.enabled && asset.driveFileId) {
      await storageQueue.add(
        "rebuild_hls_from_drive",
        { videoId: v.id },
        { removeOnComplete: true, removeOnFail: 50 }
      );
    }
  }

  await prisma.nftEventLog.create({
    data: { actorId: null, action: "STORAGE_HEALTH_SCAN", dataJson: JSON.stringify({ limit, ok, degraded, down }) },
  });

  return { ok: true, scanned: videos.length, okCount: ok, degradedCount: degraded, downCount: down };
}
