import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

async function getRole(playlistId: string, viewerId?: string, isAdmin?: boolean) {
  if (isAdmin) return "OWNER" as const;
  if (!viewerId) return "NONE" as const;

  const pl = await prisma.playlist.findUnique({ where: { id: playlistId }, select: { ownerId: true } });
  if (!pl) return "NONE" as const;
  if (pl.ownerId === viewerId) return "OWNER" as const;

  const collab = await prisma.playlistCollaborator.findUnique({
    where: { playlistId_userId: { playlistId, userId: viewerId } },
    select: { role: true },
  });

  if (!collab) return "NONE" as const;
  return collab.role === "EDITOR" ? ("EDITOR" as const) : ("VIEWER" as const);
}

function canView(visibility: string, role: "OWNER" | "EDITOR" | "VIEWER" | "NONE") {
  if (role !== "NONE") return true;
  return visibility === "PUBLIC" || visibility === "UNLISTED";
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  // Owner-only fields
  isSeries: z.boolean().optional(),
  seriesSlug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .nullable(),
  seriesDescription: z.string().max(5000).optional().nullable(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";

  const playlist = await prisma.playlist.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      ownerId: true,
      title: true,
      description: true,
      visibility: true,
      coverKey: true,
      isSeries: true,
      seriesSlug: true,
      seriesDescription: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, username: true } },
      items: {
        orderBy: [{ sort: "asc" }, { addedAt: "asc" }],
        take: 500,
        select: {
          id: true,
          sort: true,
          addedAt: true,
          video: {
            select: {
              id: true,
              title: true,
              thumbKey: true,
              viewCount: true,
              likeCount: true,
              starCount: true,
              status: true,
              isSensitive: true,
            },
          },
        },
      },
    },
  });

  if (!playlist) return Response.json({ error: "Not found" }, { status: 404 });

  const role = await getRole(playlist.id, viewerId, isAdmin);
  if (!canView(playlist.visibility as any, role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json({ playlist, role }, { status: 200 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!viewerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.playlist.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true },
  });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const role = await getRole(existing.id, viewerId, isAdmin);
  if (!(role === "OWNER" || role === "EDITOR")) return Response.json({ error: "Forbidden" }, { status: 403 });

  const bodyRaw = (await req.json().catch(() => null)) as any;
  const body = patchSchema.parse({
    title: bodyRaw?.title,
    description: bodyRaw?.description,
    visibility: bodyRaw?.visibility,
    isSeries: bodyRaw?.isSeries,
    seriesSlug: bodyRaw?.seriesSlug ?? undefined,
    seriesDescription: bodyRaw?.seriesDescription ?? undefined,
  });

  const data: any = {};
  if (body.title != null) data.title = body.title;
  if (body.description != null) data.description = body.description;

  // Only owner/admin can change visibility/series settings.
  const isOwnerOrAdmin = role === "OWNER";
  if (isOwnerOrAdmin && body.visibility != null) data.visibility = body.visibility;
  if (isOwnerOrAdmin && body.isSeries != null) data.isSeries = body.isSeries;
  if (isOwnerOrAdmin && body.seriesSlug !== undefined) data.seriesSlug = body.seriesSlug;
  if (isOwnerOrAdmin && body.seriesDescription !== undefined) data.seriesDescription = body.seriesDescription;

  const playlist = await prisma.playlist.update({
    where: { id: params.id },
    data,
    select: {
      id: true,
      title: true,
      description: true,
      visibility: true,
      coverKey: true,
      isSeries: true,
      seriesSlug: true,
      seriesDescription: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json({ playlist }, { status: 200 });
}
