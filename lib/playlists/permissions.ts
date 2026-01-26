import { prisma } from "@/lib/prisma";

export type PlaylistRole = "OWNER" | "EDITOR" | "VIEWER" | "NONE";

export async function getPlaylistRole(args: {
  playlistId: string;
  viewerId?: string | null;
  isAdmin?: boolean;
}): Promise<PlaylistRole> {
  if (args.isAdmin) return "OWNER";
  const viewerId = args.viewerId ?? undefined;
  if (!viewerId) return "NONE";
  const pl = await prisma.playlist.findUnique({ where: { id: args.playlistId }, select: { ownerId: true } });
  if (!pl) return "NONE";
  if (pl.ownerId === viewerId) return "OWNER";

  const collab = await prisma.playlistCollaborator.findUnique({
    where: { playlistId_userId: { playlistId: args.playlistId, userId: viewerId } },
    select: { role: true },
  });
  if (!collab) return "NONE";
  return collab.role === "EDITOR" ? "EDITOR" : "VIEWER";
}

export function canViewPlaylistByRole(visibility: string, role: PlaylistRole) {
  if (role === "OWNER" || role === "EDITOR" || role === "VIEWER") return true;
  return visibility === "PUBLIC" || visibility === "UNLISTED";
}

export function canEditPlaylistByRole(role: PlaylistRole) {
  return role === "OWNER" || role === "EDITOR";
}
