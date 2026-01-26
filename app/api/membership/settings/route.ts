import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isPremiumPlus } from "@/lib/membership";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  // Only Premium+ can set this preference.
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { membershipTier: true, membershipExpiresAt: true } });
  if (!me || !isPremiumPlus(me as any)) {
    return new Response("FORBIDDEN", { status: 403 });
  }

  const form = await req.formData();
  const hide = form.get("premiumPlusHideBoostAds") === "on";

  await prisma.user.update({ where: { id: userId }, data: { premiumPlusHideBoostAds: hide } });

  redirect("/premium");
}
