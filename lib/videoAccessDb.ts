import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { canInteractWithVideo, canViewVideo, getViewerId, getViewerMembership, type VideoAccessRow } from "@/lib/videoAccess";
import { fanClubTierMeetsOrHigher, getViewerFanClubTier, type FanClubTier } from "@/lib/creatorFanClub";
import { getActiveSeasonPass } from "@/lib/seasonPass";

/**
 * DB-aware wrapper for `canViewVideo`.
 *
 * Motivation:
 * - PREMIUM videos require checking creator memberships and one-time unlocks (MySQL).
 * - PUBLIC videos may be "Early Access" (Fan Club tier required until a date).
 */
export async function canViewVideoDb(video: VideoAccessRow, session: Session | null) {
  const viewerId = getViewerId(session);

  // Early Access gating (PUBLIC only)
  const access = (video.access ?? "PUBLIC") as any;
  if (access === "PUBLIC") {
    const now = new Date();
    let earlyAccessTier = (video as any).earlyAccessTier as FanClubTier | null | undefined;
    let earlyAccessUntil = (video as any).earlyAccessUntil as Date | string | null | undefined;

    // Some callers select only the minimal fields. Fetch early-access fields only when needed.
    if (earlyAccessTier === undefined && earlyAccessUntil === undefined) {
      const row = await prisma.video.findUnique({
        where: { id: video.id },
        select: { earlyAccessTier: true, earlyAccessUntil: true, authorId: true, status: true },
      });
      earlyAccessTier = (row?.earlyAccessTier ?? null) as any;
      earlyAccessUntil = (row?.earlyAccessUntil ?? null) as any;
      (video as any).authorId = (video as any).authorId ?? row?.authorId ?? null;
      (video as any).status = (video as any).status ?? (row?.status as any);
    }

    const until = earlyAccessUntil ? new Date(earlyAccessUntil as any) : null;
    if (earlyAccessTier && until && until.getTime() > now.getTime()) {
      // Owner/admin can always view.
      const baseCanView = canViewVideo(video, session);
      if (baseCanView && (session?.user?.role === "ADMIN" || (viewerId && video.authorId && viewerId === video.authorId))) {
        return true;
      }

      if (!viewerId || !video.authorId) return false;
      const viewerTier = await getViewerFanClubTier(viewerId, video.authorId);
      return fanClubTierMeetsOrHigher(earlyAccessTier, viewerTier);
    }

    // No early access gate
    return canViewVideo(video, session);
  }

  // Non-PREMIUM can use base logic.
  if (access !== "PREMIUM") return canViewVideo(video, session);

  if (!viewerId) return canViewVideo(video, session, { creatorMembershipActive: false, videoUnlocked: false });

  // Avoid extra queries for owner/admin: `canViewVideo` handles that.
  const memBase = getViewerMembership(session);

  const pass = await getActiveSeasonPass(viewerId);
  if (pass) {
    return canViewVideo(video, session, { ...memBase, creatorMembershipActive: true, videoUnlocked: true });
  }

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
  // If viewer cannot view (including early access), they also cannot interact.
  const canView = await canViewVideoDb(video, session);
  if (!canView) return false;

  const access = (video.access ?? "PUBLIC") as any;
  if (access !== "PREMIUM") return canInteractWithVideo(video, session);

  const viewerId = getViewerId(session);
  if (!viewerId) return false;

  const memBase = getViewerMembership(session);

  const pass = await getActiveSeasonPass(viewerId);
  if (pass) {
    return canInteractWithVideo(video, session, { ...memBase, creatorMembershipActive: true, videoUnlocked: true });
  }

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
