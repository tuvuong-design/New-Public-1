import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { createHoldTx, releaseHoldNowTx, releaseMaturedHoldsTx } from "@/lib/stars/holds";

export const runtime = "nodejs";

function toInt(v: FormDataEntryValue | null, def = 0) {
  const n = Number(v ?? def);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData();
  const back = String(form.get("back") || req.headers.get("referer") || "/nft/market");
  const amountStars = Math.max(1, toInt(form.get("amountStars"), 0));

  await prisma.$transaction(async (tx) => {
    // Release matured holds so user can bid using unlocked proceeds.
    await releaseMaturedHoldsTx(tx, userId);

    const auction = await tx.nftAuction.findUnique({
      where: { id: params.id },
      include: {
        item: {
          include: {
            collection: { select: { creatorId: true } },
            video: { select: { authorId: true } },
          },
        },
        highestBid: { select: { id: true, bidderId: true, amountStars: true, holdId: true } },
      },
    });

    if (!auction) throw new Error("AUCTION_NOT_FOUND");
    if (auction.status !== "ACTIVE") throw new Error("AUCTION_NOT_ACTIVE");

    const now = new Date();
    if (auction.endAt <= now) throw new Error("AUCTION_ENDED");
    if (auction.sellerId === userId) throw new Error("CANNOT_BID_OWN_AUCTION");

    const item = auction.item;
    if (!item) throw new Error("ITEM_NOT_FOUND");
    if (item.marketplaceFrozen || item.exportStatus !== "NONE") throw new Error("MARKETPLACE_FROZEN");

    const minBid = auction.highestBid ? Math.max(auction.startPriceStars, Number(auction.highestBid.amountStars) + 1) : Math.max(1, auction.startPriceStars);
    if (amountStars < minBid) throw new Error("BID_TOO_LOW");

    // Create hold for bidder.
    const hold = await createHoldTx(tx, {
      userId,
      amountStars,
      reason: "NFT_AUCTION_BID_HOLD",
      refType: "NftAuction",
      refId: auction.id,
      releaseAt: null,
      txTypeForAudit: "NFT_SALE",
      note: `Hold ${amountStars} stars for auction bid (auction=${auction.id})`,
    });

    const bid = await tx.nftBid.create({
      data: { auctionId: auction.id, bidderId: userId, amountStars, holdId: hold.id },
      select: { id: true },
    });

    // Update highest bid.
    await tx.nftAuction.update({ where: { id: auction.id }, data: { highestBidId: bid.id } });

    // Refund previous highest bid hold (outbid).
    if (auction.highestBid?.holdId) {
      await releaseHoldNowTx(tx, auction.highestBid.holdId, `Outbid refund for auction ${auction.id}`);
    }
  });

  redirect(back);
}
