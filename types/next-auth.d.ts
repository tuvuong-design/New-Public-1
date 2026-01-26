import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
      name?: string | null;
      email?: string | null;
      image?: string | null;
      membershipTier?: "NONE" | "PREMIUM" | "PREMIUM_PLUS";
      membershipExpiresAt?: Date | string | null;
      premiumPlusHideBoostAds?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "USER" | "ADMIN";
    membershipTier?: "NONE" | "PREMIUM" | "PREMIUM_PLUS";
    membershipExpiresAt?: Date | string | null;
    premiumPlusHideBoostAds?: boolean;
  }
}
