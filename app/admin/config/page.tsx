import { getSiteConfig } from "@/lib/siteConfig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

export default async function AdminConfig() {
  const cfg = await getSiteConfig();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Site config</CardTitle>
              <CardDescription>Cấu hình tổng cho website (SEO, GA/GTM, IndexNow, OneSignal, Experience).</CardDescription>
            </div>
            <Badge variant="secondary">/admin/config</Badge>
          </div>
        </CardHeader>
      </Card>

      <form action="/api/admin/site-config" method="post" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branding</CardTitle>
            <CardDescription>Tên site / mô tả mặc định / logo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="siteName">Site name</Label>
              <Input id="siteName" name="siteName" defaultValue={cfg.siteName} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultDescription">Default description</Label>
              <Textarea id="defaultDescription" name="defaultDescription" defaultValue={cfg.defaultDescription} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input id="logoUrl" name="logoUrl" defaultValue={cfg.logoUrl ?? ""} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analytics</CardTitle>
            <CardDescription>Google Analytics / Google Tag Manager / verification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox id="gaEnabled" name="gaEnabled" defaultChecked={cfg.gaEnabled} />
              <Label htmlFor="gaEnabled" className="cursor-pointer">GA Enabled</Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gaMeasurementId">GA Measurement ID</Label>
              <Input id="gaMeasurementId" name="gaMeasurementId" placeholder="G-XXXXXXXX" defaultValue={cfg.gaMeasurementId ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gtmContainerId">GTM Container ID</Label>
              <Input id="gtmContainerId" name="gtmContainerId" placeholder="GTM-XXXXXXX" defaultValue={cfg.gtmContainerId ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="googleVerification">Google site verification</Label>
              <Input id="googleVerification" name="googleVerification" placeholder="google-site-verification=..." defaultValue={cfg.googleVerification ?? ""} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">IndexNow</CardTitle>
            <CardDescription>Đẩy URL mới lên Bing/IndexNow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox id="indexNowEnabled" name="indexNowEnabled" defaultChecked={cfg.indexNowEnabled} />
              <Label htmlFor="indexNowEnabled" className="cursor-pointer">IndexNow Enabled</Label>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="indexNowKey">IndexNow key</Label>
              <Input id="indexNowKey" name="indexNowKey" placeholder="your-indexnow-key" defaultValue={cfg.indexNowKey ?? ""} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Experience</CardTitle>
            <CardDescription>Feature flags cho UI/UX.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox id="feedTikTokEnabled" name="feedTikTokEnabled" defaultChecked={(cfg as any).feedTikTokEnabled} />
              <Label htmlFor="feedTikTokEnabled" className="cursor-pointer">Bật TikTok vertical cho /feed</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="storyboardEnabled" name="storyboardEnabled" defaultChecked={(cfg as any).storyboardEnabled} />
              <Label htmlFor="storyboardEnabled" className="cursor-pointer">Bật Storyboard preview khi scrub</Label>
            </div>

<div className="flex items-center gap-3">
  <Checkbox id="playerP2PEnabled" name="playerP2PEnabled" defaultChecked={(cfg as any).playerP2PEnabled} />
  <Label htmlFor="playerP2PEnabled" className="cursor-pointer">Bật P2P segments (PUBLIC only) — experimental</Label>
</div>
<div className="text-xs text-zinc-500">
  Yêu cầu cài dependency <code>p2p-media-loader-hlsjs</code>. Nếu chưa cài thì player vẫn chạy bình thường (fallback HTTP).
</div>

            <div className="grid gap-2">
              <Label htmlFor="sensitiveDefaultMode">Sensitive videos default</Label>
              <Select
                id="sensitiveDefaultMode"
                name="sensitiveDefaultMode"
                defaultValue={String((cfg as any).sensitiveDefaultMode ?? "BLUR")}
              >
                <option value="SHOW">SHOW (hiển thị bình thường)</option>
                <option value="BLUR">BLUR (làm mờ + cảnh báo)</option>
                <option value="HIDE">HIDE (ẩn khỏi danh sách)</option>
              </Select>
              <div className="text-xs text-zinc-500">
                Áp dụng cho guest / fallback (user có thể override trên trang cá nhân).
              </div>
            </div>

          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="text-base">Membership (Premium / Premium+)</CardTitle>
            <CardDescription>Giá theo sao (stars) + quyền Premium+.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="premiumPriceStars">Premium price (stars)</Label>
              <Input id="premiumPriceStars" name="premiumPriceStars" type="number" min={0} defaultValue={(cfg as any).premiumPriceStars} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="premiumDurationDays">Premium duration (days)</Label>
              <Input id="premiumDurationDays" name="premiumDurationDays" type="number" min={1} defaultValue={(cfg as any).premiumDurationDays} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="premiumPlusPriceStars">Premium+ price (stars)</Label>
              <Input id="premiumPlusPriceStars" name="premiumPlusPriceStars" type="number" min={0} defaultValue={(cfg as any).premiumPlusPriceStars} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="premiumPlusDurationDays">Premium+ duration (days)</Label>
              <Input id="premiumPlusDurationDays" name="premiumPlusDurationDays" type="number" min={1} defaultValue={(cfg as any).premiumPlusDurationDays} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="premiumPlusFreeBoostsPerMonth">Premium+ free boosts / month</Label>
              <Input id="premiumPlusFreeBoostsPerMonth" name="premiumPlusFreeBoostsPerMonth" type="number" min={0} defaultValue={(cfg as any).premiumPlusFreeBoostsPerMonth} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">NFT</CardTitle>
            <CardDescription>Cấu hình phí mint & marketplace/export fees (nội bộ + export on-chain).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="nftCollectionMintFeeStars">Collection mint fee (stars)</Label>
              <Input id="nftCollectionMintFeeStars" name="nftCollectionMintFeeStars" type="number" min={0} defaultValue={(cfg as any).nftCollectionMintFeeStars} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nftItemMintFeeStars">Item mint fee (stars)</Label>
              <Input id="nftItemMintFeeStars" name="nftItemMintFeeStars" type="number" min={0} defaultValue={(cfg as any).nftItemMintFeeStars} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nftPlatformFeeBps">Platform fee (bps)</Label>
              <Input id="nftPlatformFeeBps" name="nftPlatformFeeBps" type="number" min={0} max={10000} defaultValue={(cfg as any).nftPlatformFeeBps} />
              <div className="text-xs text-zinc-500">100 bps = 1%</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nftDefaultRoyaltyBps">Default royalty (bps)</Label>
              <Input id="nftDefaultRoyaltyBps" name="nftDefaultRoyaltyBps" type="number" min={0} max={10000} defaultValue={(cfg as any).nftDefaultRoyaltyBps} />
              <div className="text-xs text-zinc-500">Royalty là phí người bán trả cho creator/author khi bán lại (0-10%).</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nftMaxRoyaltyBps">Max royalty (bps)</Label>
              <Input id="nftMaxRoyaltyBps" name="nftMaxRoyaltyBps" type="number" min={0} max={10000} defaultValue={(cfg as any).nftMaxRoyaltyBps} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nftUnverifiedFirstSaleHoldDays">Unverified first sale hold (days)</Label>
              <Input id="nftUnverifiedFirstSaleHoldDays" name="nftUnverifiedFirstSaleHoldDays" type="number" min={0} defaultValue={(cfg as any).nftUnverifiedFirstSaleHoldDays} />
              <div className="text-xs text-zinc-500">Lần bán đầu tiên NFT UNVERIFIED: giữ tiền người bán trong N ngày.</div>
            </div>
            <Separator />
            <div className="grid gap-2">
              <Label htmlFor="nftExportBaseFeeStars">Export base fee (stars)</Label>
              <Input id="nftExportBaseFeeStars" name="nftExportBaseFeeStars" type="number" min={0} defaultValue={(cfg as any).nftExportBaseFeeStars} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nftExportUploadMediaFeePerGbStars">Export media upload fee / GB (stars)</Label>
              <Input id="nftExportUploadMediaFeePerGbStars" name="nftExportUploadMediaFeePerGbStars" type="number" min={0} defaultValue={(cfg as any).nftExportUploadMediaFeePerGbStars} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nftExportContractChangeDelayHours">Contract change delay (hours)</Label>
              <Input id="nftExportContractChangeDelayHours" name="nftExportContractChangeDelayHours" type="number" min={0} defaultValue={(cfg as any).nftExportContractChangeDelayHours} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nftExportMirrorMode">Export mirror mode</Label>
              <Select id="nftExportMirrorMode" name="nftExportMirrorMode" defaultValue={String((cfg as any).nftExportMirrorMode ?? "READ_ONLY")}
              >
                <option value="READ_ONLY">READ_ONLY (nội bộ chỉ hiển thị, không trade)</option>
                <option value="MIRROR">MIRROR (mirror owner on-chain)</option>
              </Select>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="text-base">NFT Gated Features</CardTitle>
            <CardDescription>Bật/tắt các tính năng NFT-gated (Proof-of-Fandom, Premium NFT unlock, Creator Pass, Badges). Mặc định: tắt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox id="nftGatedMembershipEnabled" name="nftGatedMembershipEnabled" defaultChecked={(cfg as any).nftGatedMembershipEnabled} />
              <Label htmlFor="nftGatedMembershipEnabled" className="cursor-pointer">Bật NFT Gated Membership (Proof-of-Fandom)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="nftPremiumUnlockEnabled" name="nftPremiumUnlockEnabled" defaultChecked={(cfg as any).nftPremiumUnlockEnabled} />
              <Label htmlFor="nftPremiumUnlockEnabled" className="cursor-pointer">Bật NFT Unlock cho video PREMIUM</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="creatorPassEnabled" name="creatorPassEnabled" defaultChecked={(cfg as any).creatorPassEnabled} />
              <Label htmlFor="creatorPassEnabled" className="cursor-pointer">Bật Creator Pass (discount/perks)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="achievementBadgesEnabled" name="achievementBadgesEnabled" defaultChecked={(cfg as any).achievementBadgesEnabled} />
              <Label htmlFor="achievementBadgesEnabled" className="cursor-pointer">Bật NFT Rewards Badges (achievements)</Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="clipNftMarketplaceMode">Clip as NFT mode</Label>
              <Select id="clipNftMarketplaceMode" name="clipNftMarketplaceMode" defaultValue={String((cfg as any).clipNftMarketplaceMode ?? "SEPARATE_ONLY")}>
                <option value="SEPARATE_ONLY">Option 1: Clip NFT (separate tracking only)</option>
                <option value="MARKETPLACE_ONLY">Option 2: Marketplace only (list/buy by Stars)</option>
                <option value="BOTH">Both (tracking + marketplace)</option>
              </Select>
              <div className="text-xs text-zinc-500">
                Tuỳ chọn admin theo yêu cầu: Option 1/2 hoặc hỗ trợ cả hai.
              </div>

              <div className="mt-3 flex items-center gap-3">
                <Checkbox id="clipNftOnChainMintEnabled" name="clipNftOnChainMintEnabled" defaultChecked={Boolean((cfg as any).clipNftOnChainMintEnabled)} />
                <Label htmlFor="clipNftOnChainMintEnabled" className="cursor-pointer">Bật mint NFT on-chain (Solana) cho Clip (Option 1)</Label>
              </div>
              <div className="text-xs text-zinc-500">
                Khi bật: worker sẽ chạy job `nft:clip_mint_nft` để mint NFT thật on-chain (cần SOLANA_RPC_URL + SOLANA_MINT_AUTHORITY_SECRET_JSON + SOLANA_NFT_MINT_ENABLED=true).
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Treasury</CardTitle>
            <CardDescription>User nhận phí (NFT mint fee, platform fee…).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="treasuryUserId">Treasury userId</Label>
              <Input id="treasuryUserId" name="treasuryUserId" defaultValue={(cfg as any).treasuryUserId ?? ""} />
              <div className="text-xs text-zinc-500">Nếu bỏ trống: fees sẽ không cộng vào ai (vẫn trừ người dùng).</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">OneSignal</CardTitle>
            <CardDescription>Push notification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox id="oneSignalEnabled" name="oneSignalEnabled" defaultChecked={cfg.oneSignalEnabled} />
              <Label htmlFor="oneSignalEnabled" className="cursor-pointer">OneSignal Enabled</Label>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oneSignalAppId">OneSignal App ID</Label>
              <Input id="oneSignalAppId" name="oneSignalAppId" defaultValue={cfg.oneSignalAppId ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oneSignalSafariWebId">OneSignal Safari Web ID</Label>
              <Input id="oneSignalSafariWebId" name="oneSignalSafariWebId" defaultValue={cfg.oneSignalSafariWebId ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oneSignalRestApiKey">OneSignal REST API key</Label>
              <Textarea id="oneSignalRestApiKey" name="oneSignalRestApiKey" defaultValue={cfg.oneSignalRestApiKey ?? ""} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <Separator />
            <div className="flex items-center justify-end gap-2">
              <Button type="submit">Save</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
