import path from "node:path";
import fs from "node:fs";
import OpenAI from "openai";
import { prisma } from "../prisma";
import { env, flags } from "../env";
import { tmpdir, rmrf } from "../utils/fs";
import { CACHE_CONTROL_1_HOUR, downloadToFile, uploadFile } from "../utils/r2io";
import { execCmd } from "../utils/exec";

function toVtt(text: string) {
  // Very simple VTT: split by lines and assign 2s each (placeholder).
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let t = 0;
  const cues = lines.map((l, i) => {
    const start = t; const end = t + 2;
    t += 2;
    return `${i+1}\n${fmt(start)} --> ${fmt(end)}\n${l}\n`;
  });
  return `WEBVTT\n\n${cues.join("\n")}`;
}
function fmt(sec: number) {
  const hh = String(Math.floor(sec / 3600)).padStart(2,"0");
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2,"0");
  const ss = String(Math.floor(sec % 60)).padStart(2,"0");
  const ms = "000";
  return `${hh}:${mm}:${ss}.${ms}`;
}

export async function generateSubtitles(videoId: string, lang: string) {
  if (!env.OPENAI_API_KEY) return { ok: true, skipped: true, reason: "OPENAI_API_KEY missing" };

  const v = await prisma.video.findUnique({ where: { id: videoId } });
  if (!v) throw new Error("Video not found");

  const work = tmpdir("videoshare-sub-");
  const input = path.join(work, "input");
  const audio = path.join(work, "audio.mp3");
  const vtt = path.join(work, `sub-${lang}.vtt`);

  try {
    await downloadToFile(v.sourceKey, input);

    // Extract audio
    const res = await execCmd("ffmpeg", ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audio]);
    if (res.code !== 0) throw new Error("ffmpeg audio failed: " + res.stderr);

    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const file = fs.createReadStream(audio);

    // Using transcription endpoint; note: depends on OpenAI SDK version.
    const tr: any = await client.audio.transcriptions.create({
      file: file as any,
      model: env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
      response_format: "text",
      language: lang === "vi" ? "vi" : undefined,
    });

    const text = typeof tr === "string" ? tr : (tr?.text ?? "");
    fs.writeFileSync(vtt, toVtt(text), "utf-8");

    const key = `videos/${videoId}/subtitles/${lang}.vtt`;
    await uploadFile(key, vtt, "text/vtt; charset=utf-8", { cacheControl: CACHE_CONTROL_1_HOUR });

    await prisma.subtitle.upsert({
      where: { videoId_lang: { videoId, lang } },
      update: { vttKey: key, provider: "openai-whisper" },
      create: { videoId, lang, vttKey: key, provider: "openai-whisper" },
    });

    return { ok: true, key };
  } finally {
    rmrf(work);
  }
}
