import path from "node:path";
import fs from "node:fs";
import { prisma } from "../../prisma";
import { tmpdir, rmrf } from "../../utils/fs";
import { uploadDir } from "../../utils/r2io";
import { execCmd } from "../../utils/exec";
import { avoidUpscale, parseLadderJson } from "../../utils/hlsLadder";
import { getStorageShape, decryptSecret, normalizeBasePath } from "../../storage/config";
import { makeDriveClient, downloadFileFromDrive } from "../../storage/drive";
import { withFtp, ftpUploadDir } from "../../storage/ftp";

async function hasAudioStream(input: string) {
  const res = await execCmd("ffprobe", ["-v","error","-select_streams","a:0","-show_entries","stream=index","-of","csv=p=0", input]);
  return res.code === 0 && res.stdout.trim().length > 0;
}

export async function rebuildHlsFromDriveJob(args: { videoId: string }) {
  const v = await prisma.video.findUnique({ where: { id: args.videoId } });
  if (!v) throw new Error("Video not found");

  const asset = await prisma.videoAsset.findUnique({ where: { videoId: v.id } });
  if (!asset?.driveFileId) throw new Error("DRIVE_FILE_ID_MISSING");

  const cfg = await getStorageShape();
  if (!cfg.drive.enabled || !cfg.drive.secretId || !cfg.drive.folderId) throw new Error("DRIVE_NOT_CONFIGURED");

  const sec = await decryptSecret<{ json: string }>(cfg.drive.secretId);
  const jsonStr = sec?.json || "";
  if (!jsonStr) throw new Error("DRIVE_SECRET_INVALID");

  // HLS config
  const hlsCfg = await prisma.hlsConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      segmentSeconds: 6,
      packaging: "SINGLE_FILE",
      ladderJson: JSON.stringify([
        { height: 1080, videoKbps: 5000, audioKbps: 128 },
        { height: 720, videoKbps: 2800, audioKbps: 128 },
        { height: 480, videoKbps: 1400, audioKbps: 96 },
        { height: 360, videoKbps: 900, audioKbps: 64 },
      ]),
    },
  });

  const segmentSeconds = Math.max(2, Math.min(15, Math.floor(hlsCfg.segmentSeconds)));
  const fpsAssume = 30;
  const gop = Math.max(30, segmentSeconds * fpsAssume);

  let ladder = parseLadderJson(hlsCfg.ladderJson);
  ladder = avoidUpscale(ladder, v.height);

  const encodeId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const work = tmpdir("vs-rebuild-");
  const input = path.join(work, "input.mp4");
  const outDir = path.join(work, "hls");
  fs.mkdirSync(outDir, { recursive: true });

  try {
    const drive = await makeDriveClient(jsonStr);
    await downloadFileFromDrive({ drive, fileId: asset.driveFileId, destPath: input });

    const audio = await hasAudioStream(input);
    const n = ladder.length;
    const splitLabels = Array.from({ length: n }, (_, i) => `v${i}in`);
    const outLabels = ladder.map((r) => `v${r.height}`);

    const filters: string[] = [];
    filters.push(`[0:v]split=${n}${splitLabels.map((l) => `[${l}]`).join("")}`);

    for (let i = 0; i < n; i++) {
      const rung = ladder[i];
      filters.push(`[${splitLabels[i]}]scale=-2:${rung.height}:flags=lanczos[${outLabels[i]}]`);
    }

    const maps: string[] = [];
    const enc: string[] = [];
    const varStreams: string[] = [];

    for (let idx = 0; idx < n; idx++) {
      const rung = ladder[idx];
      const label = outLabels[idx];

      maps.push("-map", `[${label}]`);
      if (audio) maps.push("-map", "0:a:0?");

      enc.push(`-c:v:${idx}`, "libx264");
      enc.push(`-profile:v:${idx}`, "high");
      enc.push(`-level:v:${idx}`, "4.1");
      enc.push(`-pix_fmt:v:${idx}`, "yuv420p");
      enc.push(`-preset:v:${idx}`, "veryfast");
      enc.push(`-b:v:${idx}`, `${rung.videoKbps}k`);
      enc.push(`-maxrate:v:${idx}`, `${Math.round(rung.videoKbps * 1.3)}k`);
      enc.push(`-bufsize:v:${idx}`, `${Math.round(rung.videoKbps * 2.0)}k`);
      enc.push(`-g:v:${idx}`, String(gop));
      enc.push(`-keyint_min:v:${idx}`, String(gop));
      enc.push(`-sc_threshold:v:${idx}`, "0");
      enc.push(`-force_key_frames:v:${idx}`, `expr:gte(t,n_forced*${segmentSeconds})`);

      if (audio) {
        enc.push(`-c:a:${idx}`, "aac");
        enc.push(`-b:a:${idx}`, `${rung.audioKbps}k`);
        enc.push(`-ac:a:${idx}`, "2");
      }

      if (audio) varStreams.push(`v:${idx},a:${idx},name:${rung.height}p`);
      else varStreams.push(`v:${idx},name:${rung.height}p`);
    }

    const masterName = "master.m3u8";
    const useFmp4 = (hlsCfg.packaging || "SINGLE_FILE") === "FMP4";
    const segmentExt = useFmp4 ? "m4s" : "ts";

    const ffArgs = [
      "-y",
      "-i",
      input,
      "-filter_complex",
      filters.join(";"),
      ...maps,
      ...enc,
      "-f",
      "hls",
      "-hls_time",
      String(segmentSeconds),
      "-hls_playlist_type",
      "vod",
      "-hls_flags",
      "independent_segments",
      ...(useFmp4 ? ["-hls_segment_type", "fmp4", "-hls_fmp4_init_filename", "init_%v.mp4"] : []),
      "-hls_segment_filename",
      path.join(outDir, `seg_%v_%05d.${segmentExt}`),
      "-master_pl_name",
      masterName,
      "-var_stream_map",
      varStreams.join(" "),
      path.join(outDir, "v%v.m3u8"),
    ];

    const res = await execCmd("ffmpeg", ffArgs);
    if (res.code !== 0) throw new Error("ffmpeg hls failed: " + res.stderr);

    const prefix = `videos/${v.id}/hls/${encodeId}`;
    await uploadDir(prefix, outDir);
    const masterM3u8Key = `${prefix}/${masterName}`;

    // Mirror to FTP HLS (optional)
    if (cfg.ftpHls.enabled && cfg.ftpHls.uploadEnabled && cfg.ftpHls.secretId) {
      const ftpSec = await decryptSecret<{ password: string }>(cfg.ftpHls.secretId);
      const password = ftpSec?.password || "";
      if (password) {
        const base = normalizeBasePath(cfg.ftpHls.basePath);
        const remoteDir = [base, prefix].filter(Boolean).join("/");
        await withFtp({ host: cfg.ftpHls.host, port: cfg.ftpHls.port, username: cfg.ftpHls.username, password }, async (client) => {
          await ftpUploadDir(client, outDir, remoteDir);
        });
      }
    }

    await prisma.video.update({ where: { id: v.id }, data: { hlsBasePath: prefix, masterM3u8Key, status: "PROCESSING" } });
    await prisma.videoAsset.upsert({
      where: { videoId: v.id },
      create: { videoId: v.id, healthStatus: "OK" as any, lastHealthCheckedAt: new Date() },
      update: { healthStatus: "OK" as any, lastHealthCheckedAt: new Date() },
    });

    await prisma.nftEventLog.create({ data: { actorId: null, action: "STORAGE_REBUILD_HLS_FROM_DRIVE_OK", dataJson: JSON.stringify({ videoId: v.id, masterM3u8Key }) } });

    return { ok: true, masterM3u8Key };
  } catch (e: any) {
    const msg = String(e?.message || e);
    await prisma.nftEventLog.create({ data: { actorId: null, action: "STORAGE_REBUILD_HLS_FROM_DRIVE_FAILED", dataJson: JSON.stringify({ videoId: v.id, error: msg }) } });
    throw e;
  } finally {
    rmrf(work);
  }
}
