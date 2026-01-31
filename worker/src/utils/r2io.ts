import fs from "node:fs";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "../r2";

export const CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable";
export const CACHE_CONTROL_1_HOUR = "public, max-age=3600";
// HLS playlists should have short cache + SWR to avoid stale manifests
export const CACHE_CONTROL_PLAYLIST = "public, max-age=30, stale-while-revalidate=60";

type UploadOptions = {
  cacheControl?: string;
};

export async function downloadToFile(key: string, filePath: string) {
  const out = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  if (!out.Body) throw new Error("Missing Body");
  const body = out.Body as any as NodeJS.ReadableStream;
  await new Promise<void>((resolve, reject) => {
    const ws = fs.createWriteStream(filePath);
    body.pipe(ws);
    body.on("error", reject);
    ws.on("error", reject);
    ws.on("finish", () => resolve());
  });
}

export async function uploadFile(
  key: string,
  filePath: string,
  contentType?: string,
  opts?: UploadOptions
) {
  const body = fs.createReadStream(filePath);
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: opts?.cacheControl,
    })
  );
}

export async function uploadBuffer(
  key: string,
  buf: Buffer,
  contentType?: string,
  opts?: UploadOptions
) {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: contentType,
      CacheControl: opts?.cacheControl,
    })
  );
}

export async function uploadDir(prefixKey: string, dir: string, opts?: UploadOptions) {
  const files: string[] = [];
  function walk(p: string) {
    for (const name of fs.readdirSync(p)) {
      const full = path.join(p, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(dir);

  for (const f of files) {
    const rel = path.relative(dir, f).replaceAll(path.sep, "/");
    const key = `${prefixKey}/${rel}`;
    const isPlaylist = rel.endsWith(".m3u8");
    const ct = isPlaylist ? "application/vnd.apple.mpegurl" :
      rel.endsWith(".ts") ? "video/mp2t" :
      rel.endsWith(".m4s") ? "video/iso.segment" :
      rel.endsWith(".mp4") ? "video/mp4" :
      "application/octet-stream";

    const cacheControl = opts?.cacheControl ?? (isPlaylist ? CACHE_CONTROL_PLAYLIST : CACHE_CONTROL_IMMUTABLE);
    await uploadFile(key, f, ct, { cacheControl });
  }
}

export async function listPrefix(prefix: string) {
  const keys: string[] = [];
  let token: string | undefined;
  while (true) {
    const res = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of res.Contents ?? []) if (o.Key) keys.push(o.Key);
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
  }
  return keys;
}


export async function headObject(key: string) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}
