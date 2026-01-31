import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSeasonPass } from "@/lib/seasonPass";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const cfg = await prisma.paymentConfig.findUnique({
    where: { id: 1 },
    select: { seasonPassEnabled: true, seasonPassPriceStars: true },
  });

  const pass = await getActiveSeasonPass(userId);

  return Response.json({
    ok: true,
    enabled: cfg?.seasonPassEnabled ?? false,
    priceStars: cfg?.seasonPassPriceStars ?? 300,
    pass,
  });
}
