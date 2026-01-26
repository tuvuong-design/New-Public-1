import { prisma } from "@/lib/prisma";
import { isAdAllowedForRequest } from "@/lib/userAgent";
import { auth } from "@/lib/auth";
import { getActiveMembershipTier } from "@/lib/membership";

export async function GET(req: Request) {
  // Note: this endpoint is called from the client (so we can apply UA + bot checks).
  const session = await auth();

  const mem = {
    membershipTier: ((session?.user as any)?.membershipTier ?? "NONE") as any,
    membershipExpiresAt: (session?.user as any)?.membershipExpiresAt
      ? new Date(((session?.user as any).membershipExpiresAt) as any)
      : null,
  };

  const activeTier = getActiveMembershipTier(mem as any);
  // Premium & Premium+ hide HTML ads completely.
  const allowHtmlAds = activeTier === "NONE";

  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get("scope") ?? "FEED").toUpperCase();
  const row = await prisma.adPlacement.findUnique({ where: { scope } });
  if (!row) return Response.json({ enabled: false, everyN: 0, html: "" }, { status: 200 });

  if (!allowHtmlAds) {
    return Response.json({ enabled: false, everyN: row.everyN, html: "" }, { status: 200 });
  }

  const allowed = isAdAllowedForRequest(
    {
      enabled: row.enabled,
      showOnDesktop: row.showOnDesktop,
      showOnTablet: row.showOnTablet,
      showOnMobile: row.showOnMobile,
      hideForBots: row.hideForBots,
    },
    req.headers
  );

  return Response.json({ enabled: allowed, everyN: row.everyN, html: row.html });
}
