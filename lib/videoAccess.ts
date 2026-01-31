import type { Session } from "next-auth";
import { isAdmin } from "@/lib/authz";
import type { MembershipTier } from "@/lib/membership";
import { getActiveMembershipTier } from "@/lib/membership";

export type VideoAccess = "PUBLIC" | "PRIVATE" | "PREMIUM" | "PREMIUM_PLUS" | "VIOLATOR_ONLY";
export type VideoStatus = "DRAFT" | "PROCESSING" | "PUBLISHED" | "HIDDEN" | "ERROR" | "DELETED";

export type VideoAccessRow = {
  id: string;
  status: VideoStatus;
  access: VideoAccess;
  authorId: string | null;
    earlyAccessTier?: "BRONZE" | "SILVER" | "GOLD" | null;
  earlyAccessUntil?: Date | string | null;
};

export function getViewerId(session: Session | null) {
  return (session?.user as any)?.id as string | undefined;
}

export function getViewerMembership(session: Session | null): { membershipTier: MembershipTier; membershipExpiresAt: Date | null; premiumPlusHideBoostAds?: boolean } {
  const u = (session?.user as any) as any;
  return {
    membershipTier: (u?.membershipTier ?? "NONE") as MembershipTier,
    membershipExpiresAt: (u?.membershipExpiresAt ? new Date(u.membershipExpiresAt) : null) as Date | null,
    premiumPlusHideBoostAds: Boolean(u?.premiumPlusHideBoostAds),
  };
}

export function canViewVideo(
  video: VideoAccessRow,
  session: Session | null,
  viewerMembership?: {
    membershipTier?: MembershipTier | null;
    membershipExpiresAt?: Date | null;
    // Creator Fan Club membership (for PREMIUM videos)
    creatorMembershipActive?: boolean;
    // One-time video unlock (for PREMIUM videos)
    videoUnlocked?: boolean;
  }
) {
  const viewerId = getViewerId(session);
  const admin = isAdmin(session);
  const isOwner = viewerId && video.authorId && viewerId === video.authorId;

  // Deleted / hidden / draft are owner/admin only
  if (video.status !== "PUBLISHED") {
    return Boolean(admin || isOwner);
  }

  const access = (video.access ?? "PUBLIC") as VideoAccess;
  if (access === "PUBLIC") return true;
  if (access === "PRIVATE") return Boolean(admin || isOwner);
  // View-only mode: allow viewing but block interactions via canInteractWithVideo.
  if (access === "VIOLATOR_ONLY") return true;

  // PREMIUM (creator paid content)
  if (access === "PREMIUM") {
    if (admin || isOwner) return true;
    const extra = viewerMembership ?? {};
    return Boolean(extra.videoUnlocked || extra.creatorMembershipActive);
  }

  // PREMIUM_PLUS
  if (admin || isOwner) return true;

  // Session may already contain membership info; otherwise caller passes in viewerMembership.
  const mem = viewerMembership ?? getViewerMembership(session);
  const tier = getActiveMembershipTier(mem as any);
  return tier === "PREMIUM_PLUS";
}

export function canInteractWithVideo(
  video: VideoAccessRow,
  session: Session | null,
  viewerMembership?: {
    membershipTier?: MembershipTier | null;
    membershipExpiresAt?: Date | null;
    creatorMembershipActive?: boolean;
    videoUnlocked?: boolean;
  }
) {
  if (!canViewVideo(video, session, viewerMembership)) return false;
  const access = (video.access ?? "PUBLIC") as VideoAccess;
  if (access === "VIOLATOR_ONLY") return false;
  if (video.interactionsLocked) return false;
  return true;
}

export function normalizeVideoAccess(input: unknown): VideoAccess {
  const v = String(input ?? "").toUpperCase();
  if (v === "PUBLIC" || v === "PRIVATE" || v === "PREMIUM" || v === "PREMIUM_PLUS" || v === "VIOLATOR_ONLY") return v as VideoAccess;
  return "PUBLIC";
}

export function normalizeVideoStatus(input: unknown): VideoStatus {
  const v = String(input ?? "").toUpperCase();
  if (v === "DRAFT" || v === "PROCESSING" || v === "PUBLISHED" || v === "HIDDEN" || v === "ERROR" || v === "DELETED") return v as VideoStatus;
  return "PUBLISHED";
}
