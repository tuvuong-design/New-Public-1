import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSiteConfig } from "@/lib/siteConfig";
import { releaseMaturedHoldsTx } from "@/lib/stars/holds";

function addDays(d: Date, days: number) {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(d.getTime() + ms);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const form = await req.formData();
  const tier = String(form.get("tier") ?? "").toUpperCase();
  if (tier !== "PREMIUM" && tier !== "PREMIUM_PLUS") {
    return new Response("Invalid tier", { status: 400 });
  }

  const cfg = await getSiteConfig();
  const premiumPriceStars = (cfg as any).premiumPriceStars ?? 500;
  const premiumDays = (cfg as any).premiumDurationDays ?? 30;
  const premiumPlusPriceStars = (cfg as any).premiumPlusPriceStars ?? 900;
  const premiumPlusDays = (cfg as any).premiumPlusDurationDays ?? 30;

  const price = tier === "PREMIUM" ? Number(premiumPriceStars) : Number(premiumPlusPriceStars);
  const days = tier === "PREMIUM" ? Number(premiumDays) : Number(premiumPlusDays);

  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
    return new Response("Invalid pricing", { status: 500 });
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Opportunistically release matured holds before checking balance.
    await releaseMaturedHoldsTx(tx, userId);

    const u = await tx.user.findUnique({ where: { id: userId }, select: { id: true, starBalance: true, membershipTier: true, membershipExpiresAt: true } });
    if (!u) throw new Error("User not found");
    if ((u.starBalance ?? 0) < price) {
      throw new Error("INSUFFICIENT_STARS");
    }

    const currentExp = u.membershipExpiresAt ? new Date(u.membershipExpiresAt) : null;
    const base = currentExp && currentExp.getTime() > now.getTime() ? currentExp : now;
    const newExp = addDays(base, days);

    // Deduct stars
    await tx.user.update({ where: { id: userId }, data: { starBalance: { decrement: price }, membershipTier: tier, membershipExpiresAt: newExp } });

    await tx.starTransaction.create({
      data: {
        userId,
        type: "MEMBERSHIP_PURCHASE",
        delta: -price,
        note: `Purchase ${tier} (${days}d)`,
      },
    });
  });

  redirect("/premium");
}
