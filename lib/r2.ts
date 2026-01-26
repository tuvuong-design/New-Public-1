import { S3Client } from "@aws-sdk/client-s3";
import { requireEnv } from "./env";

export function getR2Client() {
  const env = requireEnv();
  const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
}
