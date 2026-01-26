import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";
import { queues } from "@/lib/queues";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  if (!viewerId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const cfg = await getSiteConfig();
  if (!Boolean((cfg as any).nftPremiumUnlockEnabled)) return Response.json({ ok: false, message: "NFT_PREMIUM_UNLOCK_DISABLED" }, { status: 400 });

  const videoId = ctx.params.id;
  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true, access: true, status: true } });
  if (!video) return Response.json({ ok: false, message: "VIDEO_NOT_FOUND" }, { status: 404 });
  if (video.status !== "PUBLISHED") return Response.json({ ok: false, message: "NOT_PUBLISHED" }, { status: 400 });
  if ((video.access as any) !== "PREMIUM") return Response.json({ ok: false, message: "NOT_PREMIUM" }, { status: 400 });

  const gates = await prisma.videoNftGate.findMany({ where: { videoId, enabled: true } });
  if (gates.length === 0) return Response.json({ ok: false, message: "NO_NFT_GATE" }, { status: 400 });

  const wallets = await prisma.userWallet.findMany({
    where: { userId: viewerId, verifiedAt: { not: null } },
    select: { chain: true, address: true, assets: { select: { assetKey: true, balance: true } } },
  });
  if (wallets.length === 0) return Response.json({ ok: false, message: "NO_WALLET_LINKED" }, { status: 400 });

  // Enqueue a fast sync to reduce false negatives (non-blocking).
  await queues.nft.add(
    "nft_gate_sync",
    { reason: "premium_nft_check", addresses: wallets.map((w) => ({ chain: w.chain, address: w.address })) },
    { removeOnComplete: true, removeOnFail: 1000 }
  );

  const allowed = gates.some((g) => {
    const keys = [g.collectionAddress, g.tokenMint].filter(Boolean).map((x) => String(x));
    return wallets.some((w) =>
      w.chain === g.chain &&
      w.assets.some((a) => a.balance >= 1 && keys.some((k) => String(a.assetKey) === k || String(a.assetKey).toLowerCase() === String(k).toLowerCase()))
    );
  });

  if (allowed) return Response.json({ ok: true, allowed: true });

  return Response.json({
    ok: true,
    allowed: false,
    message: "NFT_NOT_OWNED_OR_NOT_SYNCED_YET",
  });
}
