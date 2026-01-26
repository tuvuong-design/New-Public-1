import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

async function canManage(playlistId: string, viewerId: string, isAdmin?: boolean) {
  if (isAdmin) return true;
  const pl = await prisma.playlist.findUnique({ where: { id: playlistId }, select: { ownerId: true } });
  return Boolean(pl && pl.ownerId === viewerId);
}

const addSchema = z.object({
  usernameOrEmail: z.string().min(1),
  role: z.enum(["VIEWER", "EDITOR"]).default("VIEWER"),
});

const delSchema = z.object({
  userId: z.string().min(1),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!viewerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await canManage(params.id, viewerId, isAdmin);
  if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });

  const collaborators = await prisma.playlistCollaborator.findMany({
    where: { playlistId: params.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, username: true, email: true } } },
  });

  return Response.json({ collaborators });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!viewerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await canManage(params.id, viewerId, isAdmin);
  if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = addSchema.parse(await req.json());
  const key = body.usernameOrEmail.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: key }, { email: key }] },
    select: { id: true },
  });
  if (!user) return Response.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const pl = await prisma.playlist.findUnique({ where: { id: params.id }, select: { ownerId: true } });
  if (!pl) return Response.json({ error: "Not found" }, { status: 404 });
  if (user.id === pl.ownerId) return Response.json({ error: "CANNOT_ADD_OWNER" }, { status: 400 });

  const collab = await prisma.playlistCollaborator.upsert({
    where: { playlistId_userId: { playlistId: params.id, userId: user.id } },
    update: { role: body.role },
    create: { playlistId: params.id, userId: user.id, role: body.role },
    select: { id: true, role: true, userId: true },
  });

  return Response.json({ collaborator: collab }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!viewerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await canManage(params.id, viewerId, isAdmin);
  if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = delSchema.parse(await req.json());
  await prisma.playlistCollaborator.delete({
    where: { playlistId_userId: { playlistId: params.id, userId: body.userId } },
  }).catch(() => null);

  return Response.json({ ok: true });
}
