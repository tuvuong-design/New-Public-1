import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getR2Client } from "@/lib/r2";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { deletePrefix } from "@/lib/r2delete";
import { invalidateSimilarVideosCache } from "@/lib/videos/similarCache";
import { enqueueCdnPurgePaths } from "@/lib/cdn/purge";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const videoId = String(form.get("videoId") ?? "");

  const v = await prisma.video.findUnique({ where: { id: videoId } });
  if (!v) return new Response("not found", { status: 404 });

  await invalidateSimilarVideosCache(videoId);

  // Delete related objects best-effort
  const r2 = getR2Client();

  // 1) Uploaded source file (lives under a different prefix, i.e. `uploads/...`)
  try {
    await r2.send(
      new DeleteObjectsCommand({ Bucket: env.R2_BUCKET, Delete: { Objects: [{ Key: v.sourceKey }] } })
    );
  } catch {}

  // 2) All derived assets (thumb/preview/storyboard/hls/subtitles/...) are stored under `videos/{videoId}/`.
  // This also cleans up old versions (we version keys for CDN-friendly immutable caching).
  try {
    await deletePrefix(`videos/${videoId}/`);
  } catch {}

  await prisma.video.delete({ where: { id: videoId } });

  enqueueCdnPurgePaths([`/v/${videoId}`, `/`], "video_delete").catch(() => {});

  redirect("/admin/videos");
}
