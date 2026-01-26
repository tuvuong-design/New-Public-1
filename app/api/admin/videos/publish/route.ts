import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { pingIndexNow } from "@/lib/indexnow";
import { env } from "@/lib/env";
import { invalidateSimilarVideosCache } from "@/lib/videos/similarCache";
import { enqueueCdnPurgePaths } from "@/lib/cdn/purge";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const videoId = String(form.get("videoId") ?? "");
  await prisma.video.update({ where: { id: videoId }, data: { status: "PUBLISHED" } });

  await invalidateSimilarVideosCache(videoId);

  // CDN purge for UI routes (R2 keys are immutable so no need purge media objects)
  enqueueCdnPurgePaths([`/v/${videoId}`, `/`, `/rss.xml`, `/sitemap.xml`], "video_publish").catch(() => {});

  // ping indexnow best-effort
  pingIndexNow([`${env.SITE_URL}/v/${videoId}`]).catch(() => {});

  redirect(`/admin/videos/${videoId}`);
}
