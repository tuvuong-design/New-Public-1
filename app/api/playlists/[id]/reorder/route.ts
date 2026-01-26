import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

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

const schema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(1000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!viewerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await canEdit(params.id, viewerId, isAdmin);
  if (!ok) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = schema.parse(await req.json());
  const ids = body.itemIds;

  // Validate all items belong to playlist
  const items = await prisma.playlistItem.findMany({
    where: { playlistId: params.id, id: { in: ids } },
    select: { id: true },
    take: 1000,
  });
  if (items.length !== ids.length) return Response.json({ error: "INVALID_ITEMS" }, { status: 400 });

  await prisma.$transaction(
    ids.map((id, idx) =>
      prisma.playlistItem.update({
        where: { id },
        data: { sort: idx + 1 },
      }),
    ),
  );

  return Response.json({ ok: true });
}
