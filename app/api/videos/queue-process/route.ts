import { queues } from "@/lib/queues";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ videoId: z.string().min(1) });

export async function POST(req: Request) {
  const body = schema.parse(await req.json());
  const v = await prisma.video.findUnique({ where: { id: body.videoId } });
  if (!v) return new Response("not found", { status: 404 });

  await queues.processVideo.add("process", { videoId: body.videoId }, { removeOnComplete: true, removeOnFail: 100 });
  return Response.json({ ok: true });
}
