import path from "node:path";
import fs from "node:fs";
import { prisma } from "../prisma";
import { tmpdir, rmrf } from "../utils/fs";
import { CACHE_CONTROL_IMMUTABLE, downloadToFile, uploadFile } from "../utils/r2io";
import { execCmd } from "../utils/exec";
import { clamavScan } from "./clamavScan";

function safeJsonParse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

async function ffprobe(file: string) {
  const args = [
    "-v", "error",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    file,
  ];
  const res = await execCmd("ffprobe", args);
  if (res.code !== 0) throw new Error("ffprobe failed: " + res.stderr);
  return safeJsonParse<any>(res.stdout, {});
}

export async function processVideo(videoId: string) {
  const v = await prisma.video.findUnique({ where: { id: videoId } });
  if (!v) throw new Error("Video not found");

  // Use immutable keys for derived assets so we can aggressively cache at the edge.
  // New processing run => new key => no need to purge CDN.
  const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const work = tmpdir("videoshare-");
  const input = path.join(work, "input");
  const thumb = path.join(work, "thumb.jpg");
  const preview = path.join(work, "preview.mp4");

  try {
    await downloadToFile(v.sourceKey, input);

    const av = await clamavScan(input);
    if (av.ok === false) {
      await prisma.video.update({ where: { id: videoId }, data: { status: "ERROR" } });
      throw new Error("Virus detected");
    }

    const meta = await ffprobe(input);
    const vstream = (meta.streams ?? []).find((s: any) => s.codec_type === "video");
    const durationSec = Math.floor(Number(meta.format?.duration ?? 0));
    const width = Number(vstream?.width ?? 0);
    const height = Number(vstream?.height ?? 0);

    // Thumbnail at 1s
    {
      const res = await execCmd("ffmpeg", ["-y", "-ss", "1", "-i", input, "-vframes", "1", "-q:v", "3", thumb]);
      if (res.code !== 0) throw new Error("ffmpeg thumb failed: " + res.stderr);
    }

    // Preview 10s
    {
      const res = await execCmd("ffmpeg", ["-y", "-ss", "0", "-t", "10", "-i", input, "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-an", preview]);
      if (res.code !== 0) throw new Error("ffmpeg preview failed: " + res.stderr);
    }


// Storyboard (sprite) - only if enabled in SiteConfig
const site = await prisma.siteConfig.upsert({ where: { id: 1 }, update: {}, create: {} });
let storyboardKey: string | null = null;
let storyboardFrameW = 160;
let storyboardFrameH = 90;
let storyboardCols = 10;
let storyboardRows = 10;
let storyboardCount = 0;
let storyboardIntervalMs = 2000;

if (site.storyboardEnabled) {
  const durationSafe = Math.max(1, durationSec || 1);
  const intervalSec = Math.max(0.5, durationSafe / 100); // <=100 frames
  storyboardIntervalMs = Math.round(intervalSec * 1000);
  storyboardCount = Math.min(100, Math.max(1, Math.ceil(durationSafe / intervalSec)));

  const storyboardDir = path.join(work, "storyboard");
  fs.mkdirSync(storyboardDir, { recursive: true });
  const storyboardPath = path.join(storyboardDir, "storyboard.jpg");

  const vf = [
    `fps=1/${intervalSec.toFixed(4)}`,
    `scale=${storyboardFrameW}:${storyboardFrameH}:force_original_aspect_ratio=decrease`,
    `pad=${storyboardFrameW}:${storyboardFrameH}:(ow-iw)/2:(oh-ih)/2`,
    `tile=${storyboardCols}x${storyboardRows}`
  ].join(",");

  const sbRes = await execCmd("ffmpeg", ["-y", "-i", input, "-vf", vf, "-frames:v", "1", "-q:v", "4", storyboardPath]);
  if (sbRes.code === 0 && fs.existsSync(storyboardPath)) {
    storyboardKey = `videos/${videoId}/storyboard/${buildId}.jpg`;
    await uploadFile(storyboardKey, storyboardPath, "image/jpeg", { cacheControl: CACHE_CONTROL_IMMUTABLE });
  }
}

    const base = `videos/${videoId}`;
    const thumbKey = `${base}/thumb/${buildId}.jpg`;
    const previewKey = `${base}/preview/${buildId}.mp4`;

    await uploadFile(thumbKey, thumb, "image/jpeg", { cacheControl: CACHE_CONTROL_IMMUTABLE });
    await uploadFile(previewKey, preview, "video/mp4", { cacheControl: CACHE_CONTROL_IMMUTABLE });

    await prisma.video.update({
      where: { id: videoId },
      data: { durationSec, width, height, thumbKey, previewKey, status: "PROCESSING", storyboardKey, storyboardFrameW, storyboardFrameH, storyboardCols, storyboardRows, storyboardCount, storyboardIntervalMs },
    });

    return { ok: true, workDir: work, inputPath: input };
  } finally {
    // keep workdir for encodeHls step (encode job will re-download if needed); to avoid huge tmp, we remove here.
    rmrf(work);
  }
}
