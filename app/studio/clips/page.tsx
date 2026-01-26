import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function StudioClipsPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const cfg = await getSiteConfig();
  const mode = String((cfg as any).clipNftMarketplaceMode ?? "SEPARATE_ONLY");
  const onChainEnabled = Boolean((cfg as any).clipNftOnChainMintEnabled);

  const clips = await prisma.clip.findMany({
    where: { creatorId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      video: { select: { id: true, title: true } },
      clipNft: { include: { mints: { orderBy: { serial: "asc" } } } } as any,
      nftItems: { select: { id: true, title: true, createdAt: true, listings: { select: { id: true, status: true, priceStars: true }, orderBy: { createdAt: "desc" }, take: 1 } } } as any,
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Clips</CardTitle>
          <CardDescription>
            Mint/List clip highlights theo mode admin. On-chain mint chạy trong worker (không block web request).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Clip as NFT mode:</span> <Badge variant="secondary">{mode}</Badge>
          <span className="ml-2">On-chain mint:</span> <Badge variant={onChainEnabled ? "default" : "secondary"}>{onChainEnabled ? "ENABLED" : "DISABLED"}</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {clips.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">Chưa có clip nào.</Card>
        ) : (
          clips.map((c) => {
            const latestListing = (c.nftItems?.[0] as any)?.listings?.[0] as any | undefined;
            const clipNft = c.clipNft as any | null;
            const mintedCount = clipNft?.mints?.length ?? 0;
            const desired = clipNft?.editionSize ?? 1;

            return (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{c.title ?? "Untitled clip"}</div>
                    <div className="text-xs text-muted-foreground">
                      Video: {c.video.title} · {c.startSec}s–{c.endSec}s · status={c.status}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">ClipNFT: {clipNft ? clipNft.status : "—"}</Badge>
                    <Badge variant="secondary">Marketplace: {c.nftItems.length ? "✅" : "—"}</Badge>
                    {clipNft?.status === "MINTED" && clipNft.mintAddress ? (
                      <Badge variant="secondary">Minted: {String(clipNft.mintAddress).slice(0, 6)}…</Badge>
                    ) : null}
                  </div>
                </div>

                <Separator className="my-3" />

                <form action={`/api/studio/clips/${c.id}/mint`} method="post" className="grid gap-3 md:grid-cols-4">
                  <div className="grid gap-1">
                    <Label htmlFor={`priceStars_${c.id}`}>Price (Stars)</Label>
                    <Input id={`priceStars_${c.id}`} name="priceStars" type="number" min={0} max={1000000} defaultValue={latestListing?.priceStars ?? 0} />
                    <label className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <input type="checkbox" name="listNow" defaultChecked={(latestListing?.status === "ACTIVE") && (Number(latestListing?.priceStars ?? 0) > 0)} />
                      List now (marketplace)
                    </label>
                    <div className="text-[11px] text-muted-foreground">0 = không list marketplace.</div>
                  </div>

                  <div className="grid gap-1">
                    <Label htmlFor={`editionSize_${c.id}`}>Edition size</Label>
                    <Input id={`editionSize_${c.id}`} name="editionSize" type="number" min={1} max={100} defaultValue={clipNft?.editionSize ?? 1} />
                    <div className="text-[11px] text-muted-foreground">Mint on-chain: tạo N NFT riêng lẻ.</div>
                  </div>

                  <div className="grid gap-1">
                    <Label htmlFor={`royaltyBps_${c.id}`}>Royalty (bps)</Label>
                    <Input id={`royaltyBps_${c.id}`} name="royaltyBps" type="number" min={0} max={Number((cfg as any).nftMaxRoyaltyBps ?? 1000)} defaultValue={clipNft?.royaltyBps ?? Number((cfg as any).nftDefaultRoyaltyBps ?? 500)} />
                    <div className="text-[11px] text-muted-foreground">100 = 1%, 500 = 5%.</div>
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <Button type="submit" variant="secondary">Save & Mint/List</Button>
                    <a href={`/studio/videos/${c.videoId}/access`} className="text-sm underline">Video access</a>
                  </div>
                </form>

                {clipNft ? (
                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    <div>
                      On-chain editions: {mintedCount}/{desired}
                      {clipNft.txHash ? ` · tx=${String(clipNft.txHash).slice(0, 8)}…` : ""}
                    </div>
                    {clipNft.lastError ? (
                      <div className="text-red-600">Last error: {String(clipNft.lastError).slice(0, 200)}</div>
                    ) : null}
                    {clipNft.mints?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {clipNft.mints.slice(0, 6).map((m: any) => (
                          <Badge key={m.id} variant="secondary">#{m.serial}:{String(m.mintAddress).slice(0, 6)}…</Badge>
                        ))}
                        {clipNft.mints.length > 6 ? <Badge variant="secondary">+{clipNft.mints.length - 6}</Badge> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
