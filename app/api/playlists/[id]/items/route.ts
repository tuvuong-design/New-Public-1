import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function canEdit(playlistId: string, viewerId: string, isAdmin?: boolean) {
  if (isAdmin) return true;
  const pl = await prisma.playlist.findUnique({ where: { id: playlistId }, select: { ownerId: true } });
  if (!pl) return false;
  if (pl.ownerId === viewerId) return true;
  const collab = await prisma.playlistCollaborator.findUnique({
    where: { playlistId_userId: { playlistId, userId: viewerId } },
    select: { role: true },
  });
  return collab?.role === "EDITOR";
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!viewerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await canEdit(params.id, viewerId, isAdmin);
  if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as any;
  const videoId = String(body?.videoId ?? "").trim();
  if (!videoId) return Response.json({ error: "videoId required" }, { status: 400 });

  const v = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true, status: true } });
  if (!v || v.status === "DELETED") return Response.json({ error: "Video not found" }, { status: 404 });

  // Compute sort = max+1
  const max = await prisma.playlistItem.aggregate({
    where: { playlistId: params.id },
    _max: { sort: true },
  });
  const sort = (max._max.sort ?? 0) + 1;

  const item = await prisma.playlistItem.upsert({
    where: { playlistId_videoId: { playlistId: params.id, videoId } },
    update: { sort },
    create: { playlistId: params.id, videoId, sort },
    select: { id: true, playlistId: true, videoId: true, sort: true, addedAt: true },
  });

  return Response.json({ item }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!viewerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await canEdit(params.id, viewerId, isAdmin);
  if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as any;
  const videoId = String(body?.videoId ?? "").trim();
  const itemId = String(body?.itemId ?? "").trim();
  if (!videoId && !itemId) return Response.json({ error: "videoId or itemId required" }, { status: 400 });

  if (itemId) {
    await prisma.playlistItem.delete({ where: { id: itemId } }).catch(() => null);
  } else {
    await prisma.playlistItem.delete({ where: { playlistId_videoId: { playlistId: params.id, videoId } } }).catch(() => null);
  }

  return Response.json({ ok: true });
}
