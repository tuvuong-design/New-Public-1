import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queues } from "@/lib/queues";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  videoId: z.string().min(1),
  startSec: z.number().int().min(0),
  endSec: z.number().int().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = schema.parse(await req.json());
  if (body.endSec <= body.startSec) {
    return Response.json({ ok: false, error: "INVALID_RANGE" }, { status: 400 });
  }

  const v = await prisma.video.findUnique({ where: { id: body.videoId }, select: { id: true, authorId: true, status: true } });
  if (!v) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (!isAdmin && v.authorId !== userId) return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  // Guard: avoid trimming while already processing
  if (v.status === "PROCESSING") {
    return Response.json({ ok: false, error: "VIDEO_PROCESSING" }, { status: 409 });
  }

  const job = await queues.editor.add(
    "trim_video",
    { videoId: body.videoId, startSec: body.startSec, endSec: body.endSec },
    { removeOnComplete: true, removeOnFail: 200 }
  );

  return Response.json({ ok: true, jobId: job.id });
}
