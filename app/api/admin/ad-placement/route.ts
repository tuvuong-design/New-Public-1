import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const scope = String(form.get("scope") ?? "FEED").toUpperCase();
  const enabled = form.get("enabled") === "on";
  const showOnMobile = form.get("showOnMobile") === "on";
  const showOnTablet = form.get("showOnTablet") === "on";
  const showOnDesktop = form.get("showOnDesktop") === "on";
  const hideForBots = form.get("hideForBots") === "on";
  const everyN = Math.max(1, Math.min(100, Number(form.get("everyN") ?? 6)));
  const html = String(form.get("html") ?? "").slice(0, 50_000);

  await prisma.adPlacement.upsert({
    where: { scope },
    update: { enabled, showOnMobile, showOnTablet, showOnDesktop, hideForBots, everyN, html },
    create: { scope, enabled, showOnMobile, showOnTablet, showOnDesktop, hideForBots, everyN, html },
  });

  redirect("/admin/ads");
}
