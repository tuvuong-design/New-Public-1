import { prisma } from "@/lib/prisma";

// Fan Club tiers (CreatorMembershipTier).
export type FanClubTier = "BRONZE" | "SILVER" | "GOLD";

export function fanClubTierRank(tier: FanClubTier | null | undefined) {
  if (tier === "GOLD") return 3;
  if (tier === "SILVER") return 2;
  if (tier === "BRONZE") return 1;
  return 0;
}

export function fanClubTierMeetsOrHigher(required: FanClubTier | null | undefined, viewer: FanClubTier | null | undefined) {
  return fanClubTierRank(viewer) >= fanClubTierRank(required);
}

/**
 * Returns viewer's highest active Fan Club tier for a creator (or null).
 * Note: memberships are unique by (planId, userId), so a viewer could theoretically
 * have multiple plans (unlikely). We take the highest tier among active memberships.
 */
export async function getViewerFanClubTier(viewerId: string, creatorId: string): Promise<FanClubTier | null> {
  if (!viewerId || !creatorId) return null;
  const now = new Date();
  const rows = await prisma.creatorMembership.findMany({
    where: { userId: viewerId, creatorId, status: "ACTIVE", expiresAt: { gt: now } },
    select: { plan: { select: { tier: true } } },
    take: 10,
  });

  let best: FanClubTier | null = null;
  let bestRank = 0;
  for (const r of rows) {
    const t = (r.plan?.tier ?? null) as FanClubTier | null;
    const rk = fanClubTierRank(t);
    if (rk > bestRank) {
      bestRank = rk;
      best = t;
    }
  }
  return best;
}
