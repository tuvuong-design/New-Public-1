import path from "node:path";
import fs from "node:fs";
import { prisma } from "../../prisma";
import { tmpdir, rmrf } from "../../utils/fs";
import { downloadToFile } from "../../utils/r2io";
import { decryptSecret, getStorageShape, normalizeBasePath } from "../../storage/config";
import { withFtp, ftpEnsureDir } from "../../storage/ftp";
import { makeDriveClient, uploadFileToDrive } from "../../storage/drive";

export async function backupOriginJob(args: { videoId: string }) {
  const v = await prisma.video.findUnique({ where: { id: args.videoId } });
  if (!v) throw new Error("Video not found");
  const cfg = await getStorageShape();

  const work = tmpdir("vs-origin-");
  const local = path.join(work, "origin.mp4");

  try {
    await downloadToFile(v.sourceKey, local);

    await prisma.videoAsset.upsert({
      where: { videoId: v.id },
      create: { videoId: v.id },
      update: {},
    });

    // FTP origin
    if (cfg.ftpOrigin.enabled && cfg.ftpOrigin.uploadEnabled && cfg.ftpOrigin.secretId) {
      const sec = await decryptSecret<{ password: string }>(cfg.ftpOrigin.secretId);
      const password = sec?.password || "";
      if (password) {
        const base = normalizeBasePath(cfg.ftpOrigin.basePath);
        const remoteDir = [base, "videos", v.id, "origin"].filter(Boolean).join("/");
        const remoteFile = `${remoteDir}/${v.id}.mp4`;
        await withFtp({ host: cfg.ftpOrigin.host, port: cfg.ftpOrigin.port, username: cfg.ftpOrigin.username, password }, async (client) => {
          await ftpEnsureDir(client, remoteDir);
          await client.uploadFrom(local, remoteFile);
        });
        await prisma.nftEventLog.create({
          data: { actorId: null, action: "STORAGE_BACKUP_ORIGIN_FTP_OK", dataJson: JSON.stringify({ videoId: v.id, remoteFile }) },
        });
      }
    }

    // Drive
    if (cfg.drive.enabled && cfg.drive.secretId && cfg.drive.folderId) {
      const sec = await decryptSecret<{ json: string }>(cfg.drive.secretId);
      const jsonStr = sec?.json || "";
      if (jsonStr) {
        const drive = await makeDriveClient(jsonStr);
        const uploaded = await uploadFileToDrive({ drive, folderId: cfg.drive.folderId, filePath: local, name: `${v.id}.mp4`, mimeType: "video/mp4" });
        await prisma.videoAsset.upsert({
          where: { videoId: v.id },
          create: { videoId: v.id, driveFileId: uploaded.id },
          update: { driveFileId: uploaded.id },
        });
        await prisma.nftEventLog.create({
          data: { actorId: null, action: "STORAGE_BACKUP_ORIGIN_DRIVE_OK", dataJson: JSON.stringify({ videoId: v.id, driveFileId: uploaded.id }) },
        });
      }
    }

    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.message || e);
    await prisma.nftEventLog.create({
      data: { actorId: null, action: "STORAGE_BACKUP_ORIGIN_FAILED", dataJson: JSON.stringify({ videoId: v.id, error: msg }) },
    });
    throw e;
  } finally {
    try { fs.existsSync(local) && fs.unlinkSync(local); } catch {}
    rmrf(work);
  }
}
