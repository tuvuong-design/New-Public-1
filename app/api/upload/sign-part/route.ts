import { env } from "@/lib/env";
import { getR2Client } from "@/lib/r2";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const schema = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
  partNumber: z.number().int().min(1),
});

export async function POST(req: Request) {
  const body = schema.parse(await req.json());
  const r2 = getR2Client();

  const cmd = new UploadPartCommand({
    Bucket: env.R2_BUCKET,
    Key: body.key,
    UploadId: body.uploadId,
    PartNumber: body.partNumber,
  });

  const url = await getSignedUrl(r2, cmd, { expiresIn: 60 * 10 });
  return Response.json({ url });
}
