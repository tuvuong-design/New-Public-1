export type DeviceKind = "mobile" | "tablet" | "desktop" | "bot" | "unknown";

// Keep this lightweight (no external deps) – only used for basic targeting.
const BOT_RE = /(bot|crawler|spider|crawling|slurp|bingpreview|mediapartners-google|apis-google|googlebot|bingbot|yandex|duckduckbot|baiduspider|facebookexternalhit|twitterbot|linkedinbot|pinterest|whatsapp|telegrambot|discordbot|slackbot|embedly|quora\slink\spreview|skypeuripreview|applebot|ia_archiver)/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return BOT_RE.test(ua);
}

/**
 * Very small UA heuristic.
 * - Prefer `sec-ch-ua-mobile` when present.
 */
export function detectDeviceKind(opts: {
  userAgent?: string | null;
  secChUaMobile?: string | null;
}): DeviceKind {
  const ua = (opts.userAgent ?? "").toLowerCase();
  if (isBotUserAgent(ua)) return "bot";

  // Client hints
  const chMobile = (opts.secChUaMobile ?? "").toLowerCase();
  if (chMobile.includes("?1")) return "mobile";

  // Tablet heuristics
  if (
    ua.includes("ipad") ||
    ua.includes("tablet") ||
    ua.includes("kindle") ||
    ua.includes("silk/") ||
    ua.includes("playbook") ||
    ua.includes("nexus 7") ||
    ua.includes("nexus 9") ||
    ua.includes("nexus 10")
  ) {
    return "tablet";
  }

  // Mobile heuristics
  if (
    ua.includes("mobi") ||
    ua.includes("iphone") ||
    ua.includes("ipod") ||
    (ua.includes("android") && !ua.includes("tablet")) ||
    ua.includes("blackberry") ||
    ua.includes("phone")
  ) {
    return "mobile";
  }

  // Default
  return ua ? "desktop" : "unknown";
}

export type AdTargetingLike = {
  enabled: boolean;
  showOnDesktop: boolean;
  showOnTablet: boolean;
  showOnMobile: boolean;
  hideForBots: boolean;
};

export function isAdAllowedForRequest(placement: AdTargetingLike, reqHeaders: Headers): boolean {
  if (!placement.enabled) return false;
  const ua = reqHeaders.get("user-agent") ?? "";
  const device = detectDeviceKind({
    userAgent: ua,
    secChUaMobile: reqHeaders.get("sec-ch-ua-mobile"),
  });

  if (placement.hideForBots && device === "bot") return false;
  if (device === "mobile") return placement.showOnMobile;
  if (device === "tablet") return placement.showOnTablet;
  if (device === "desktop") return placement.showOnDesktop;

  // unknown => conservative
  return false;
}
