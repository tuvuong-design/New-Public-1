import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBufferToR2 } from "@/lib/r2io";

export const runtime = "nodejs";

const MAX_BYTES = 2_000_000;

async function canEdit(playlistId: string, viewerId: string, isAdmin?: boolean) {
  if (isAdmin) return true;
  const pl = await prisma.playlist.findUnique({ where: { id: playlistId }, select: { ownerId: true } });
  if (!pl) return false;
  if (pl.ownerId === viewerId) return true;
  const c = await prisma.playlistCollaborator.findUnique({
    where: { playlistId_userId: { playlistId, userId: viewerId } },
    select: { role: true },
  });
  return c?.role === "EDITOR";
}

function extFromType(ct: string) {
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!viewerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await canEdit(params.id, viewerId, isAdmin);
  if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "file required" }, { status: 400 });

  const ct = file.type || "image/jpeg";
  if (!ct.startsWith("image/")) return Response.json({ error: "INVALID_TYPE" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return Response.json({ error: "FILE_TOO_LARGE", maxBytes: MAX_BYTES }, { status: 400 });

  const build = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const key = `playlist-covers/v1/${params.id}/${build}.${extFromType(ct)}`;

  await uploadBufferToR2(key, buf, ct);

  const playlist = await prisma.playlist.update({
    where: { id: params.id },
    data: { coverKey: key },
    select: { id: true, coverKey: true },
  });

  return Response.json({ ok: true, playlist });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!viewerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await canEdit(params.id, viewerId, isAdmin);
  if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });

  const playlist = await prisma.playlist.update({
    where: { id: params.id },
    data: { coverKey: null },
    select: { id: true, coverKey: true },
  });

  return Response.json({ ok: true, playlist });
}
