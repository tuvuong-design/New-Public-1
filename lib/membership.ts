import { prisma } from "@/lib/prisma";

export type MembershipTier = "NONE" | "PREMIUM" | "PREMIUM_PLUS";

export function isMembershipActive(user: { membershipTier?: MembershipTier | null; membershipExpiresAt?: Date | null }) {
  const tier = (user.membershipTier ?? "NONE") as MembershipTier;
  if (tier === "NONE") return false;
  const exp = user.membershipExpiresAt ?? null;
  if (!exp) return true;
  return exp.getTime() > Date.now();
}

export function getActiveMembershipTier(user: { membershipTier?: MembershipTier | null; membershipExpiresAt?: Date | null }): MembershipTier {
  const tier = (user.membershipTier ?? "NONE") as MembershipTier;
  if (tier === "NONE") return "NONE";
  return isMembershipActive(user) ? tier : "NONE";
}

export function isPremium(user: { membershipTier?: MembershipTier | null; membershipExpiresAt?: Date | null }) {
  const tier = getActiveMembershipTier(user);
  return tier === "PREMIUM" || tier === "PREMIUM_PLUS";
}

export function isPremiumPlus(user: { membershipTier?: MembershipTier | null; membershipExpiresAt?: Date | null }) {
  return getActiveMembershipTier(user) === "PREMIUM_PLUS";
}

export async function getMembershipForUserId(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, membershipTier: true, membershipExpiresAt: true, premiumPlusHideBoostAds: true },
  });
}

export function monthKey(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}
