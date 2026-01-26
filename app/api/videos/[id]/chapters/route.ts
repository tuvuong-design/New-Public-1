import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canViewVideoDb } from "@/lib/videoAccessDb";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const videoId = ctx.params.id;
  const session = await auth();

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, status: true, access: true, interactionsLocked: true, authorId: true, deletedAt: true },
  });
  if (!video) return new Response("not found", { status: 404 });

  if (!(await canViewVideoDb(video as any, session))) {
    return new Response("forbidden", { status: 403 });
  }

  const chapters = await prisma.videoChapter.findMany({
    where: { videoId },
    orderBy: { startSec: "asc" },
    select: { id: true, startSec: true, title: true },
  });

  return Response.json({ ok: true, chapters });
}
