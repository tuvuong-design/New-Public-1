import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { getR2Client } from "@/lib/r2";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { grantXp } from "@/lib/gamification/grantXp";

const schema = z.object({
  filename: z.string().min(1),
  size: z.number().int().positive(),
  type: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  isSensitive: z.boolean().optional().default(false),
  access: z.enum(["PUBLIC", "PREMIUM_PLUS", "PRIVATE"]).optional().default("PUBLIC"),
});

export async function POST(req: Request) {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;

  const body = schema.parse(await req.json());
  if (body.access !== "PUBLIC" && !uid) return new Response("Auth required", { status: 401 });
  if (body.size > env.UPLOAD_MAX_BYTES) return new Response("File too large", { status: 413 });

  const r2 = getR2Client();
  const key = `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}-${body.filename}`;

  const cmd = new CreateMultipartUploadCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    ContentType: body.type || "application/octet-stream",
    Metadata: {
      originalname: body.filename,
    },
  });
  const out = await r2.send(cmd);
  if (!out.UploadId) return new Response("Failed to create multipart upload", { status: 500 });

  const video = await prisma.video.create({
    data: {
      title: body.title,
      description: body.description,
      status: "PROCESSING",
      isSensitive: body.isSensitive,
      access: body.access,
      sourceKey: key,
      sourceBytes: BigInt(body.size),
      authorId: uid ?? null,
    },
  });

  if (uid) {
    // Task 12: Gamification XP (upload)
    grantXp({
      userId: uid,
      sourceKey: `UPLOAD:${video.id}`,
      amount: 20,
      badgeKey: "FIRST_UPLOAD",
      badgeName: "First Upload",
      badgeDescription: "Upload video lần đầu",
      badgeIcon: "⬆️",
      dailyKey: "UPLOAD",
      dailyGoal: 1,
      dailyInc: 1,
    }).catch(() => {});
  }

  return Response.json({ videoId: video.id, uploadId: out.UploadId, key, partSize: env.UPLOAD_PART_BYTES });
}
