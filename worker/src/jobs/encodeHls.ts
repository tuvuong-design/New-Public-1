import path from "node:path";
import fs from "node:fs";
import { prisma } from "../prisma";
import { tmpdir, rmrf } from "../utils/fs";
import { downloadToFile, uploadDir } from "../utils/r2io";
import { execCmd } from "../utils/exec";
import { avoidUpscale, parseLadderJson } from "../utils/hlsLadder";
import { getStorageShape, decryptSecret, normalizeBasePath } from "../storage/config";
import { withFtp, ftpUploadDir } from "../storage/ftp";

async function hasAudioStream(input: string) {
  // Returns true if input has at least 1 audio stream.
  const res = await execCmd("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=index",
    "-of",
    "csv=p=0",
    input,
  ]);

  return res.code === 0 && res.stdout.trim().length > 0;
}

export async function encodeHls(videoId: string) {
  const v = await prisma.video.findUnique({ where: { id: videoId } });
  if (!v) throw new Error("Video not found");

  // Versioned HLS path => safe to cache playlists/segments as immutable on CDN.
  // Re-encode => new prefix => no purge required.
  const encodeId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // HLS config is administered at /admin/hls.
  // IMPORTANT: Ladder JSON is generated from checkbox UI (doc v3.1+).
  const cfg = await prisma.hlsConfig.upsert({
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

  const segmentSeconds = Math.max(2, Math.min(15, Math.floor(cfg.segmentSeconds)));

  // Keyframe alignment for HLS: force a keyframe at multiples of segmentSeconds.
  // We keep GOP close to segment duration too.
  const fpsAssume = 30; // best-effort; exact fps isn't required with force_key_frames expr
  const gop = Math.max(30, segmentSeconds * fpsAssume);

  let ladder = parseLadderJson(cfg.ladderJson);
  ladder = avoidUpscale(ladder, v.height);

  const packaging = (cfg.packaging || "SINGLE_FILE").toUpperCase();
  const isHybrid = packaging === "HYBRID_TS_ABR_FMP4_SOURCE";

  const work = tmpdir("videoshare-hls-");
  const input = path.join(work, "input");
  const outDir = path.join(work, "hls");
  const outDirTs = path.join(work, "hls_ts");
  const outDirFmp4 = path.join(work, "hls_fmp4");
  fs.mkdirSync(outDir, { recursive: true });
  if (isHybrid) {
    fs.mkdirSync(outDirTs, { recursive: true });
    fs.mkdirSync(outDirFmp4, { recursive: true });
  }

  try {
    await downloadToFile(v.sourceKey, input);

    const audio = await hasAudioStream(input);

    const encodeLadder = async (targetOutDir: string, useFmp4: boolean, useLadder: typeof ladder) => {
      const n = useLadder.length;
      const splitLabels = Array.from({ length: n }, (_, i) => `v${i}in`);
      const outLabels = useLadder.map((r) => `v${r.height}`);

      const filters: string[] = [];
      filters.push(`[0:v]split=${n}${splitLabels.map((l) => `[${l}]`).join("")}`);

      for (let i = 0; i < n; i++) {
        const rung = useLadder[i];
        const inLabel = splitLabels[i];
        const outLabel = outLabels[i];
        filters.push(`[${inLabel}]scale=-2:${rung.height}:flags=lanczos[${outLabel}]`);
      }

      const maps: string[] = [];
      const enc: string[] = [];
      const varStreams: string[] = [];

      for (let idx = 0; idx < n; idx++) {
        const rung = useLadder[idx];
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
        path.join(targetOutDir, `seg_%v_%05d.${segmentExt}`),
        "-master_pl_name",
        masterName,
        "-var_stream_map",
        varStreams.join(" "),
        path.join(targetOutDir, "v%v.m3u8"),
      ];

      const res = await execCmd("ffmpeg", ffArgs);
      if (res.code !== 0) throw new Error("ffmpeg hls failed: " + res.stderr);
      return { masterName };
    };

    const encodeSourceFmp4 = async (targetOutDir: string) => {
      // "Source" packaging: keep original resolution, single rendition, fMP4 segments.
      const masterName = "master.m3u8";
      const ffArgs = [
        "-y",
        "-i",
        input,
        "-map",
        "0:v:0",
        ...(audio ? ["-map", "0:a:0?"] : []),
        "-c:v",
        "libx264",
        "-profile:v",
        "high",
        "-level:v",
        "4.1",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-g",
        String(gop),
        "-keyint_min",
        String(gop),
        "-sc_threshold",
        "0",
        "-force_key_frames",
        `expr:gte(t,n_forced*${segmentSeconds})`,
        ...(audio ? ["-c:a", "aac", "-b:a", "160k", "-ac", "2"] : []),
        "-f",
        "hls",
        "-hls_time",
        String(segmentSeconds),
        "-hls_playlist_type",
        "vod",
        "-hls_flags",
        "independent_segments",
        "-hls_segment_type",
        "fmp4",
        "-hls_fmp4_init_filename",
        "init_0.mp4",
        "-hls_segment_filename",
        path.join(targetOutDir, "seg_0_%05d.m4s"),
        "-master_pl_name",
        masterName,
        path.join(targetOutDir, "v0.m3u8"),
      ];
      const res = await execCmd("ffmpeg", ffArgs);
      if (res.code !== 0) throw new Error("ffmpeg hls source fmp4 failed: " + res.stderr);
      return { masterName };
    };

    if (isHybrid) {
      // Hybrid: TS ladder fixed to 1080/720/480 (avoidUpscale), plus a fMP4 "source" playlist.
      const tsHeights = new Set([1080, 720, 480]);
      const tsLadder = avoidUpscale(ladder.filter((r) => tsHeights.has(r.height)), v.height);
      if (tsLadder.length === 0) {
        // Fallback: if ladderJson doesn't include these, derive from defaults by filtering.
        const fallback = avoidUpscale(
          [
            { height: 1080, videoKbps: 5000, audioKbps: 128 },
            { height: 720, videoKbps: 2800, audioKbps: 128 },
            { height: 480, videoKbps: 1400, audioKbps: 96 },
          ] as any,
          v.height
        );
        tsLadder.splice(0, tsLadder.length, ...fallback);
      }

      await encodeLadder(outDirTs, false, tsLadder as any);
      await encodeSourceFmp4(outDirFmp4);

      const prefixRoot = `videos/${videoId}/hls/${encodeId}`;
      const prefixTs = `${prefixRoot}/ts`;
      const prefixFmp4 = `${prefixRoot}/fmp4_source`;

      await uploadDir(prefixTs, outDirTs);
      await uploadDir(prefixFmp4, outDirFmp4);

      // Mirror both to FTP HLS (optional)
      try {
        const scfg = await getStorageShape();
        if (scfg.ftpHls.enabled && scfg.ftpHls.uploadEnabled && scfg.ftpHls.secretId) {
          const sec = await decryptSecret<{ password: string }>(scfg.ftpHls.secretId);
          const password = sec?.password || "";
          if (password) {
            const base = normalizeBasePath(scfg.ftpHls.basePath);
            await withFtp(
              { host: scfg.ftpHls.host, port: scfg.ftpHls.port, username: scfg.ftpHls.username, password },
              async (client) => {
                await ftpUploadDir(client, outDirTs, [base, prefixTs].filter(Boolean).join("/"));
                await ftpUploadDir(client, outDirFmp4, [base, prefixFmp4].filter(Boolean).join("/"));
              }
            );
          }
        }
      } catch (e) {
        console.error("ftp hls mirror failed", e);
      }

      const masterM3u8Key = `${prefixTs}/master.m3u8`;
      const masterM3u8KeyFmp4 = `${prefixFmp4}/master.m3u8`;

      await prisma.video.update({
        where: { id: videoId },
        data: {
          hlsBasePath: prefixTs,
          masterM3u8Key,
          hlsBasePathFmp4: prefixFmp4,
          masterM3u8KeyFmp4,
          status: "PROCESSING",
        },
      });

      return { ok: true, masterM3u8Key };
    }

    // Non-hybrid: existing single-output behavior.
    const useFmp4 = packaging === "FMP4";
    await encodeLadder(outDir, useFmp4, ladder as any);

    const prefix = `videos/${videoId}/hls/${encodeId}`;
    await uploadDir(prefix, outDir);

    // Mirror to FTP HLS (optional backup)
    try {
      const scfg = await getStorageShape();
      if (scfg.ftpHls.enabled && scfg.ftpHls.uploadEnabled && scfg.ftpHls.secretId) {
        const sec = await decryptSecret<{ password: string }>(scfg.ftpHls.secretId);
        const password = sec?.password || "";
        if (password) {
          const base = normalizeBasePath(scfg.ftpHls.basePath);
          const remoteDir = [base, prefix].filter(Boolean).join("/");
          await withFtp({ host: scfg.ftpHls.host, port: scfg.ftpHls.port, username: scfg.ftpHls.username, password }, async (client) => {
            await ftpUploadDir(client, outDir, remoteDir);
          });
        }
      }
    } catch (e) {
      // best-effort backup; do not fail primary encode
      console.error("ftp hls mirror failed", e);
    }

    const masterM3u8Key = `${prefix}/master.m3u8`;

    await prisma.video.update({
      where: { id: videoId },
      data: { hlsBasePath: prefix, masterM3u8Key, hlsBasePathFmp4: null, masterM3u8KeyFmp4: null, status: "PROCESSING" },
    });

    return { ok: true, masterM3u8Key };
  } finally {
    rmrf(work);
  }
}
