import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getR2Client } from "@/lib/r2";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

const schema = z.object({
  videoId: z.string().min(1),
  uploadId: z.string().min(1),
  key: z.string().min(1),
  parts: z.array(z.object({ PartNumber: z.number().int(), ETag: z.string().min(1) })).min(1),
});

export async function POST(req: Request) {
  const body = schema.parse(await req.json());
  const r2 = getR2Client();

  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: env.R2_BUCKET,
      Key: body.key,
      UploadId: body.uploadId,
      MultipartUpload: { Parts: body.parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })) },
    })
  );

  await prisma.video.update({
    where: { id: body.videoId },
    data: { status: "PROCESSING", sourceKey: body.key },
  });

  return Response.json({ ok: true });
}
