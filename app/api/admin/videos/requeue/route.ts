import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { queues } from "@/lib/queues";
import { prisma } from "@/lib/prisma";
import { invalidateSimilarVideosCache } from "@/lib/videos/similarCache";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const videoId = String(form.get("videoId") ?? "");
  const v = await prisma.video.findUnique({ where: { id: videoId } });
  if (!v) return new Response("not found", { status: 404 });

  await prisma.video.update({ where: { id: videoId }, data: { status: "PROCESSING" } });
  await invalidateSimilarVideosCache(videoId);
  await queues.processVideo.add("process", { videoId }, { removeOnComplete: true, removeOnFail: 100 });
  redirect(`/admin/videos/${videoId}`);
}
