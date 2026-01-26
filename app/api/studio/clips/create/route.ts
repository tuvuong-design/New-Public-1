import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queues } from "@/lib/queues";
import { canViewVideoDb } from "@/lib/videoAccessDb";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  videoId: z.string().min(1),
  startSec: z.number().int().min(0),
  endSec: z.number().int().min(1),
  title: z.string().max(120).optional(),
});

const MIN_CLIP_SEC = 15;
const MAX_CLIP_SEC = 60;

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = schema.parse(await req.json());
  if (body.endSec <= body.startSec) return Response.json({ ok: false, error: "INVALID_RANGE" }, { status: 400 });

  const duration = body.endSec - body.startSec;
  if (duration < MIN_CLIP_SEC || duration > MAX_CLIP_SEC) {
    return Response.json({ ok: false, error: "INVALID_DURATION", min: MIN_CLIP_SEC, max: MAX_CLIP_SEC }, { status: 400 });
  }

  const v = await prisma.video.findUnique({
    where: { id: body.videoId },
    select: { id: true, status: true, access: true, authorId: true, interactionsLocked: true, sourceKey: true },
  });
  if (!v) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (!v.sourceKey) return Response.json({ ok: false, error: "VIDEO_SOURCE_MISSING" }, { status: 409 });

  // View permission gate (supports PREMIUM via DB-aware guard)
  const can = await canViewVideoDb(
    { id: v.id, status: v.status as any, access: v.access as any, authorId: v.authorId, interactionsLocked: v.interactionsLocked ?? false },
    session as any,
  );
  if (!can) return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const clip = await prisma.clip.create({
    data: {
      videoId: body.videoId,
      creatorId: userId,
      startSec: body.startSec,
      endSec: body.endSec,
      title: body.title?.trim() || null,
      status: "PROCESSING",
    },
    select: { id: true },
  });

  const job = await queues.editor.add(
    "create_clip",
    { clipId: clip.id },
    { removeOnComplete: true, removeOnFail: 200, jobId: `editor:create_clip:${clip.id}` },
  );

  return Response.json({ ok: true, clipId: clip.id, jobId: job.id });
}
