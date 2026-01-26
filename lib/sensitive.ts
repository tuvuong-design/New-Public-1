import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";

export type SensitiveMode = "SHOW" | "BLUR" | "HIDE";

export function normalizeSensitiveMode(input: unknown, fallback: SensitiveMode = "BLUR"): SensitiveMode {
  const v = String(input ?? "").trim().toUpperCase();
  if (v === "SHOW" || v === "BLUR" || v === "HIDE") return v;
  return fallback;
}

/**
 * Resolve the effective viewer mode for sensitive videos.
 * - Logged-in user: use User.sensitiveMode
 * - Guest / fallback: use SiteConfig.sensitiveDefaultMode
 */
export async function getSensitiveModeForUser(userId?: string | null): Promise<SensitiveMode> {
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { sensitiveMode: true } });
    if (u?.sensitiveMode) return normalizeSensitiveMode(u.sensitiveMode);
  }

  const site = await getSiteConfig();
  return normalizeSensitiveMode((site as any).sensitiveDefaultMode);
}

export async function getViewerSensitiveMode(): Promise<SensitiveMode> {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  return getSensitiveModeForUser(uid ?? null);
}

export function shouldHideSensitiveInListings(mode: SensitiveMode): boolean {
  return mode === "HIDE";
}
