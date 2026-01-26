import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { env } from "./env";
import { z } from "zod";
import { compare } from "bcryptjs";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authOptions: NextAuthOptions = {
  secret: env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.passwordHash) return null;

        const ok = await compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        // Keep this small; the session callback will fetch fresh membership/role from DB.
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role ?? "USER";
        token.uid = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = token.uid;

      // Fetch fresh role/membership from DB to avoid stale JWT values after purchase/updates.
      if (token.uid) {
        try {
          const u = await prisma.user.findUnique({
            where: { id: token.uid as any },
            select: { role: true, membershipTier: true, membershipExpiresAt: true, premiumPlusHideBoostAds: true },
          });

          (session.user as any).role = (u as any)?.role ?? (token.role as any) ?? "USER";
          (session.user as any).membershipTier = (u as any)?.membershipTier ?? "NONE";
          (session.user as any).membershipExpiresAt = (u as any)?.membershipExpiresAt ?? null;
          (session.user as any).premiumPlusHideBoostAds = Boolean((u as any)?.premiumPlusHideBoostAds ?? false);
        } catch {
          (session.user as any).role = token.role;
          (session.user as any).membershipTier = (token as any).membershipTier ?? "NONE";
          (session.user as any).membershipExpiresAt = (token as any).membershipExpiresAt ?? null;
          (session.user as any).premiumPlusHideBoostAds = Boolean((token as any).premiumPlusHideBoostAds ?? false);
        }
      } else {
        (session.user as any).role = token.role;
        (session.user as any).membershipTier = (token as any).membershipTier ?? "NONE";
        (session.user as any).membershipExpiresAt = (token as any).membershipExpiresAt ?? null;
        (session.user as any).premiumPlusHideBoostAds = Boolean((token as any).premiumPlusHideBoostAds ?? false);
      }

      return session;
    },
  },
  pages: { signIn: "/login" },
};

export const { handlers, auth } = NextAuth(authOptions);
