import path from "node:path";
import { prisma } from "../../prisma";
import { tmpdir, rmrf } from "../../utils/fs";
import { CACHE_CONTROL_IMMUTABLE, downloadToFile, uploadFile } from "../../utils/r2io";
import { execCmd } from "../../utils/exec";
import { env } from "../../env";

function safeText(input: string) {
  const s = String(input || "").trim();
  // keep short to avoid ffmpeg filter issues
  return s.slice(0, 48).replaceAll(":", " ").replaceAll("'", " ");
}

export async function createClipJob(args: { clipId: string }) {
  const clip = await prisma.clip.findUnique({
    where: { id: args.clipId },
    include: {
      video: { select: { id: true, sourceKey: true } },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!clip) throw new Error("CLIP_NOT_FOUND");

  if (clip.status === "READY" && clip.outputKey) return { ok: true, outputKey: clip.outputKey, cached: true };

  const v = clip.video;
  if (!v?.sourceKey) throw new Error("VIDEO_SOURCE_MISSING");

  const start = Math.max(0, Math.floor(clip.startSec));
  const end = Math.max(start + 1, Math.floor(clip.endSec));

  const duration = end - start;
  if (duration < 1) throw new Error("INVALID_RANGE");

  const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const work = tmpdir("videoshare-clip-");
  const input = path.join(work, "input");
  const out = path.join(work, "clip.mp4");

  try {
    await downloadToFile(v.sourceKey, input);

    // Watermark (burn-in) using drawtext.
    const wm = safeText(`VideoShare • ${clip.creator?.name || "viewer"}`);
    const font = env.FFMPEG_FONT_PATH || "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
    const draw = `drawtext=fontfile=${font}:text='${wm}':x=w-tw-16:y=h-th-16:fontsize=18:fontcolor=white@0.9:box=1:boxcolor=black@0.35:boxborderw=8`;

    const res = await execCmd("ffmpeg", [
      "-y",
      "-ss",
      String(start),
      "-to",
      String(end),
      "-i",
      input,
      "-vf",
      draw,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      out,
    ]);

    if (res.code !== 0) throw new Error("ffmpeg_clip_failed: " + (res.stderr || res.stdout || "").slice(0, 500));

    const key = `clips/${clip.id}/mp4/${buildId}.mp4`;
    await uploadFile(key, out, "video/mp4", { cacheControl: CACHE_CONTROL_IMMUTABLE });

    await prisma.clip.update({
      where: { id: clip.id },
      data: { status: "READY", outputKey: key, errorMessage: null },
    });

    return { ok: true, outputKey: key };
  } catch (e: any) {
    await prisma.clip.update({
      where: { id: clip.id },
      data: { status: "ERROR", errorMessage: String(e?.message || e).slice(0, 500) },
    }).catch(() => {});
    throw e;
  } finally {
    rmrf(work);
  }
}
