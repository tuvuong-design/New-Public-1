import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { invalidateSimilarVideosCache } from "@/lib/videos/similarCache";
import { enqueueCdnPurgePaths } from "@/lib/cdn/purge";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const videoId = String(form.get("videoId") ?? "");
  await prisma.video.update({ where: { id: videoId }, data: { status: "HIDDEN" } });
  await invalidateSimilarVideosCache(videoId);
  enqueueCdnPurgePaths([`/v/${videoId}`, `/`], "video_hide").catch(() => {});
  redirect(`/admin/videos/${videoId}`);
}
