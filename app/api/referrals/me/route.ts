import { auth } from "@/lib/auth";
import { ensureReferralCode } from "@/lib/referrals";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const code = await ensureReferralCode(userId);
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { referredById: true } });

  const baseUrl = env.SITE_URL || env.NEXTAUTH_URL || "";
  const shareUrl = baseUrl ? `${baseUrl}/?ref=${encodeURIComponent(code)}` : `/?ref=${encodeURIComponent(code)}`;

  return Response.json({ ok: true, code, shareUrl, referredById: me?.referredById ?? null });
}
