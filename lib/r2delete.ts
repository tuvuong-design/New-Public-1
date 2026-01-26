import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { getR2Client } from "@/lib/r2";

/**
 * Delete all objects under a prefix (best-effort).
 * Uses ListObjectsV2 + batch DeleteObjects (<=1000 keys per call).
 */
export async function deletePrefix(prefix: string) {
  const r2 = getR2Client();
  const bucket = env.R2_BUCKET;

  let token: string | undefined;
  const keys: string[] = [];

  while (true) {
    const out = await r2.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );

    for (const o of out.Contents ?? []) {
      if (o.Key) keys.push(o.Key);
    }

    if (!out.IsTruncated) break;
    token = out.NextContinuationToken;
  }

  // delete in batches of 1000
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000).map((Key) => ({ Key }));
    await r2.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch } }));
  }

  return { deleted: keys.length };
}
