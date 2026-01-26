import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canInteractWithVideoDb, canViewVideoDb } from "@/lib/videoAccessDb";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const videoId = body.videoId as string;
  if (!videoId) {
    return Response.json({ error: "Missing videoId" }, { status: 400 });
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, status: true, access: true, interactionsLocked: true, authorId: true, deletedAt: true },
  });
  if (!video) {
    return Response.json({ error: "Video not found" }, { status: 404 });
  }
  if (!(await canViewVideoDb(video as any, session))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await canInteractWithVideoDb(video as any, session))) {
    return Response.json({ error: "Interactions disabled" }, { status: 403 });
  }

  await prisma.share.create({ data: { userId, videoId } });
  await prisma.video.update({ where: { id: videoId }, data: { shareCount: { increment: 1 } } });
  const updated = await prisma.video.findUnique({ where: { id: videoId }, select: { shareCount: true } });
  return Response.json({ shareCount: updated?.shareCount ?? 0 });
}
