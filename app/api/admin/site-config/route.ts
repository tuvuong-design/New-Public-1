import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { normalizeSensitiveMode } from "@/lib/sensitive";
import { redirect } from "next/navigation";
function num(form: FormData, key: string, def: number) {
  const raw = form.get(key);
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

function int(form: FormData, key: string, def: number) {
  const n = Math.floor(num(form, key, def));
  return Number.isFinite(n) ? n : def;
}


export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const siteName = String(form.get("siteName") ?? "VideoShare").slice(0, 120);
  const defaultDescription = String(form.get("defaultDescription") ?? "").slice(0, 500);
  const logoUrl = String(form.get("logoUrl") ?? "").slice(0, 500) || null;

  const gaEnabled = form.get("gaEnabled") === "on";
  const gaMeasurementId = String(form.get("gaMeasurementId") ?? "").trim() || null;
  const gtmContainerId = String(form.get("gtmContainerId") ?? "").trim() || null;
  const googleVerification = String(form.get("googleVerification") ?? "").trim() || null;

  const indexNowEnabled = form.get("indexNowEnabled") === "on";
  const indexNowKey = String(form.get("indexNowKey") ?? "").trim() || null;

  const feedTikTokEnabled = form.get("feedTikTokEnabled") === "on";
  const storyboardEnabled = form.get("storyboardEnabled") === "on";
  const playerP2PEnabled = form.get("playerP2PEnabled") === "on";
  const sensitiveDefaultMode = normalizeSensitiveMode(form.get("sensitiveDefaultMode"));

  const oneSignalEnabled = form.get("oneSignalEnabled") === "on";
  const oneSignalAppId = String(form.get("oneSignalAppId") ?? "").trim() || null;
  const oneSignalSafariWebId = String(form.get("oneSignalSafariWebId") ?? "").trim() || null;
  const oneSignalRestApiKey = String(form.get("oneSignalRestApiKey") ?? "").trim() || null;

  // Membership pricing (stars)
  const premiumPriceStars = int(form, "premiumPriceStars", 500);
  const premiumDurationDays = int(form, "premiumDurationDays", 30);
  const premiumPlusPriceStars = int(form, "premiumPlusPriceStars", 900);
  const premiumPlusDurationDays = int(form, "premiumPlusDurationDays", 30);
  const premiumPlusFreeBoostsPerMonth = int(form, "premiumPlusFreeBoostsPerMonth", 4);

  // NFT (internal + export)
  const nftCollectionMintFeeStars = int(form, "nftCollectionMintFeeStars", 50);
  const nftItemMintFeeStars = int(form, "nftItemMintFeeStars", 10);
  const nftPlatformFeeBps = int(form, "nftPlatformFeeBps", 100);
  const nftDefaultRoyaltyBps = int(form, "nftDefaultRoyaltyBps", 500);
  const nftMaxRoyaltyBps = int(form, "nftMaxRoyaltyBps", 1000);
  const nftUnverifiedFirstSaleHoldDays = int(form, "nftUnverifiedFirstSaleHoldDays", 10);
  const nftExportBaseFeeStars = int(form, "nftExportBaseFeeStars", 0);
  const nftExportUploadMediaFeePerGbStars = int(form, "nftExportUploadMediaFeePerGbStars", 0);
  const nftExportContractChangeDelayHours = int(form, "nftExportContractChangeDelayHours", 24);
  const nftExportMirrorMode = String(form.get("nftExportMirrorMode") ?? "READ_ONLY").slice(0, 40);


  // NFT gated feature flags
  const nftGatedMembershipEnabled = form.get("nftGatedMembershipEnabled") === "on";
  const nftPremiumUnlockEnabled = form.get("nftPremiumUnlockEnabled") === "on";
  const creatorPassEnabled = form.get("creatorPassEnabled") === "on";
  const achievementBadgesEnabled = form.get("achievementBadgesEnabled") === "on";
  const clipNftMarketplaceMode = String(form.get("clipNftMarketplaceMode") ?? "SEPARATE_ONLY").slice(0, 40);
  const clipNftOnChainMintEnabled = form.get("clipNftOnChainMintEnabled") === "on";

  // Treasury
  const treasuryUserId = String(form.get("treasuryUserId") ?? "").trim() || null;

  await prisma.siteConfig.upsert({
    where: { id: 1 },
    update: {
      siteName,
      defaultDescription,
      logoUrl,
      gaEnabled,
      gaMeasurementId,
      gtmContainerId,
      googleVerification,
      indexNowEnabled,
      indexNowKey,
      feedTikTokEnabled,
      storyboardEnabled,
      playerP2PEnabled,
      sensitiveDefaultMode,
      oneSignalEnabled,
      oneSignalAppId,
      oneSignalSafariWebId,
      oneSignalRestApiKey,
      premiumPriceStars,
      premiumDurationDays,
      premiumPlusPriceStars,
      premiumPlusDurationDays,
      premiumPlusFreeBoostsPerMonth,
      nftCollectionMintFeeStars,
      nftItemMintFeeStars,
      nftPlatformFeeBps,
      nftDefaultRoyaltyBps,
      nftMaxRoyaltyBps,
      nftUnverifiedFirstSaleHoldDays,
      nftExportBaseFeeStars,
      nftExportUploadMediaFeePerGbStars,
      nftExportContractChangeDelayHours,
      nftExportMirrorMode,
      nftGatedMembershipEnabled,
      nftPremiumUnlockEnabled,
      creatorPassEnabled,
      achievementBadgesEnabled,
      clipNftMarketplaceMode,
      clipNftOnChainMintEnabled,
      treasuryUserId,
    },
    create: {
      id: 1,
      siteName,
      defaultDescription,
      logoUrl,
      gaEnabled,
      gaMeasurementId,
      gtmContainerId,
      googleVerification,
      indexNowEnabled,
      indexNowKey,
      feedTikTokEnabled,
      storyboardEnabled,
      playerP2PEnabled,
      sensitiveDefaultMode,
      oneSignalEnabled,
      oneSignalAppId,
      oneSignalSafariWebId,
      oneSignalRestApiKey,
      premiumPriceStars,
      premiumDurationDays,
      premiumPlusPriceStars,
      premiumPlusDurationDays,
      premiumPlusFreeBoostsPerMonth,
      nftCollectionMintFeeStars,
      nftItemMintFeeStars,
      nftPlatformFeeBps,
      nftDefaultRoyaltyBps,
      nftMaxRoyaltyBps,
      nftUnverifiedFirstSaleHoldDays,
      nftExportBaseFeeStars,
      nftExportUploadMediaFeePerGbStars,
      nftExportContractChangeDelayHours,
      nftExportMirrorMode,
      nftGatedMembershipEnabled,
      nftPremiumUnlockEnabled,
      creatorPassEnabled,
      achievementBadgesEnabled,
      clipNftMarketplaceMode,
      clipNftOnChainMintEnabled,
      treasuryUserId,
    },
  });

  redirect("/admin/config");
}
