import { flags, isConfiguredEnv } from "@/lib/env";

/**
 * Install wizard is accessible when:
 * - env NOT configured yet, OR
 * - INSTALL_WIZARD_ENABLED=true (explicitly enabled)
 */
export function canAccessInstallWizard() {
  return !isConfiguredEnv() || flags.installWizard;
}

/** Used by middleware to redirect users to /install when env missing. */
export function shouldRedirectToInstall(pathname: string) {
  if (isConfiguredEnv()) return false;

  // allow install pages + install apis
  if (pathname.startsWith("/install")) return false;
  if (pathname.startsWith("/api/install")) return false;

  // allow health check
  if (pathname.startsWith("/api/health")) return false;
  // allow verify endpoints/pages
  if (pathname.startsWith("/api/verify")) return false;
  if (pathname.startsWith("/verify")) return false;

  // allow static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.startsWith("/llms.txt")
  ) {
    return false;
  }

  return true;
}
