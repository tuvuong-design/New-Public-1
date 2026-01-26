import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";
import { canInteractWithVideo, canViewVideo, getViewerId, getViewerMembership, type VideoAccessRow } from "@/lib/videoAccess";

/**
 * DB-aware wrapper for `canViewVideo`.
 *
 * Motivation: PREMIUM videos require checking creator memberships and one-time
 * unlocks, which are stored in MySQL.
 */
export async function canViewVideoDb(video: VideoAccessRow, session: Session | null) {
  const access = (video.access ?? "PUBLIC") as any;
  if (access !== "PREMIUM") return canViewVideo(video, session);

  const viewerId = getViewerId(session);
  if (!viewerId) return canViewVideo(video, session, { creatorMembershipActive: false, videoUnlocked: false });

  // Avoid extra queries for owner/admin: `canViewVideo` handles that.
  const memBase = getViewerMembership(session);

  const [member, unlock] = await Promise.all([
    prisma.creatorMembership.findFirst({
      where: {
        userId: viewerId,
        creatorId: video.authorId ?? "",
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }),
    prisma.videoUnlock.findUnique({
      where: { userId_videoId: { userId: viewerId, videoId: video.id } },
      select: { id: true },
    }),
  ]);

  return canViewVideo(video, session, {
    ...memBase,
    creatorMembershipActive: Boolean(member),
    videoUnlocked: Boolean(unlock),
  });
}

export async function canInteractWithVideoDb(video: VideoAccessRow, session: Session | null) {
  const access = (video.access ?? "PUBLIC") as any;
  if (access !== "PREMIUM") return canInteractWithVideo(video, session);

  const viewerId = getViewerId(session);
  if (!viewerId) return false;

  const memBase = getViewerMembership(session);
  const [member, unlock] = await Promise.all([
    prisma.creatorMembership.findFirst({
      where: { userId: viewerId, creatorId: video.authorId ?? "", status: "ACTIVE", expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
    prisma.videoUnlock.findUnique({ where: { userId_videoId: { userId: viewerId, videoId: video.id } }, select: { id: true } }),
  ]);

  return canInteractWithVideo(video, session, {
    ...memBase,
    creatorMembershipActive: Boolean(member),
    videoUnlocked: Boolean(unlock),
  });
}
