import { queues } from "@/lib/queues";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const videoId = String(form.get("videoId") ?? "");
  const lang = String(form.get("lang") ?? "vi").slice(0, 10);

  const v = await prisma.video.findUnique({ where: { id: videoId } });
  if (!v) return new Response("not found", { status: 404 });

  await queues.subtitles.add("subtitle", { videoId, lang }, { removeOnComplete: true, removeOnFail: 100 });
  redirect(`/admin/videos/${videoId}`);
}
