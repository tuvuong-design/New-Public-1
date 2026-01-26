import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";
import { requireEnv } from "@/lib/env";

export const CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable";

export async function uploadBufferToR2(key: string, buf: Buffer, contentType: string) {
  const env = requireEnv();
  const r2 = getR2Client();
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: contentType,
      CacheControl: CACHE_CONTROL_IMMUTABLE,
    }),
  );
}
