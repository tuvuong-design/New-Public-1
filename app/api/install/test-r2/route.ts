import { z } from "zod";
import { canAccessInstallWizard } from "@/lib/install/guard";

export const runtime = "nodejs";

const schema = z.object({
  r2AccountId: z.string().min(1),
  r2AccessKeyId: z.string().min(1),
  r2Secret: z.string().min(1),
  r2Bucket: z.string().min(1),
  r2PublicBase: z.string().url(),
});

export async function POST(req: Request) {
  if (!canAccessInstallWizard()) return new Response("Not found", { status: 404 });
  const body = schema.parse(await req.json());

  try {
    const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const endpoint = `https://${body.r2AccountId}.r2.cloudflarestorage.com`;
    const r2 = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId: body.r2AccessKeyId, secretAccessKey: body.r2Secret },
    });
    await r2.send(new ListObjectsV2Command({ Bucket: body.r2Bucket, MaxKeys: 1 }));
    return Response.json({ ok: true, message: "R2 connection OK" });
  } catch (e: any) {
    return Response.json({ ok: false, message: e?.message || "R2 connection failed" }, { status: 400 });
  }
}
