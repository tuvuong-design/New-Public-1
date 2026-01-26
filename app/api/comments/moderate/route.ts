import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";

  if (!viewerId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as any;
  const commentId = body?.commentId as string | undefined;
  const action = body?.action as string | undefined;

  if (!commentId || !action) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, videoId: true },
  });
  if (!comment) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const video = await prisma.video.findUnique({
    where: { id: comment.videoId },
    select: { id: true, authorId: true },
  });

  if (!video) {
    return Response.json({ error: "Video not found" }, { status: 404 });
  }

  const canModerate = isAdmin || viewerId === video.authorId;
  if (!canModerate) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }


const now = new Date();

if (action === "PIN") {
  // Only 1 pinned comment per video
  await prisma.comment.updateMany({
    where: { videoId: comment.videoId, isPinned: true },
    data: { isPinned: false, pinnedAt: null, pinnedById: null },
  });

  await prisma.comment.update({
    where: { id: commentId },
    data: { isPinned: true, pinnedAt: now, pinnedById: viewerId, moderatedAt: now, moderatedById: viewerId },
  });

  return Response.json({ ok: true });
}

if (action === "UNPIN") {
  await prisma.comment.update({
    where: { id: commentId },
    data: { isPinned: false, pinnedAt: null, pinnedById: null, moderatedAt: now, moderatedById: viewerId },
  });

  return Response.json({ ok: true });
}

if (action === "HEART") {
  await prisma.comment.update({
    where: { id: commentId },
    data: { isHearted: true, heartedAt: now, heartedById: viewerId, moderatedAt: now, moderatedById: viewerId },
  });

  return Response.json({ ok: true });
}

if (action === "UNHEART") {
  await prisma.comment.update({
    where: { id: commentId },
    data: { isHearted: false, heartedAt: null, heartedById: null, moderatedAt: now, moderatedById: viewerId },
  });

  return Response.json({ ok: true });
}

let nextVisibility: "VISIBLE" | "HIDDEN" | "DELETED" = "VISIBLE";
if (action === "HIDE") nextVisibility = "HIDDEN";
if (action === "UNHIDE") nextVisibility = "VISIBLE";
if (action === "DELETE") nextVisibility = "DELETED";

await prisma.comment.update({
  where: { id: commentId },
  data: {
    visibility: nextVisibility,
    moderatedAt: now,
    moderatedById: viewerId,
  },
});

  return Response.json({ ok: true });
}
