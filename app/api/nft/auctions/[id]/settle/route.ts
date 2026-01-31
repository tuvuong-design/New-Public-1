import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSiteConfig } from "@/lib/siteConfig";
import { calcNftSaleFees } from "@/lib/nft/fees";
import { releaseHoldNowTx } from "@/lib/stars/holds";
import { requireAdmin } from "@/lib/authz";
import { applyReferralBonusTx } from "@/lib/referrals";

export const runtime = "nodejs";

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData();
  const back = String(form.get("back") || req.headers.get("referer") || "/nft/market");

  const cfg = await getSiteConfig();
  const platformFeeBps = Number((cfg as any).nftPlatformFeeBps ?? 100);
  const holdDays = Number((cfg as any).nftUnverifiedFirstSaleHoldDays ?? 10);
  const treasuryUserId = (cfg as any).treasuryUserId as string | null | undefined;

  await prisma.$transaction(async (tx) => {
    const auction = await tx.nftAuction.findUnique({
      where: { id: params.id },
      include: {
        item: {
          include: {
            collection: { select: { id: true, creatorId: true, royaltyBps: true, creatorRoyaltySharePct: true } },
            video: { select: { id: true, authorId: true } },
          },
        },
        highestBid: { select: { id: true, bidderId: true, amountStars: true, holdId: true } },
      },
    });

    if (!auction) throw new Error("AUCTION_NOT_FOUND");
    if (auction.status !== "ACTIVE") throw new Error("AUCTION_NOT_ACTIVE");

    // Only seller or admin can settle.
    if (auction.sellerId !== userId) {
      try {
        requireAdmin(session);
      } catch {
        throw new Error("FORBIDDEN");
      }
    }

    const now = new Date();
    if (auction.endAt > now) throw new Error("AUCTION_NOT_ENDED_YET");

    const item = auction.item;
    if (!item) throw new Error("ITEM_NOT_FOUND");
    if (item.marketplaceFrozen || item.exportStatus !== "NONE") throw new Error("MARKETPLACE_FROZEN");
    if (item.ownerId !== auction.sellerId) throw new Error("OWNER_MISMATCH");

    const highest = auction.highestBid;

    // End auction first (idempotency guard)
    const ended = await tx.nftAuction.updateMany({ where: { id: auction.id, status: "ACTIVE" }, data: { status: "ENDED" } });
    if (ended.count !== 1) throw new Error("RACE_SETTLE");

    // If no bids or reserve not met => refund and exit.
    const reserve = auction.reservePriceStars ? Number(auction.reservePriceStars) : null;
    const bidAmount = highest ? Number(highest.amountStars) : 0;
    const reserveMet = reserve == null ? Boolean(highest) : Boolean(highest && bidAmount >= reserve);

    if (!highest || !reserveMet) {
      if (highest?.holdId) {
        await releaseHoldNowTx(tx, highest.holdId, `Auction ended without sale (reserve not met) auction=${auction.id}`);
      }
      await tx.nftEventLog.create({
        data: {
          actorId: userId,
          action: "NFT_AUCTION_ENDED_NO_SALE",
          dataJson: JSON.stringify({ auctionId: auction.id, highestBid: highest ? { bidId: highest.id, amountStars: bidAmount } : null, reserve }),
        },
      });
      return;
    }

    const creatorId = item.collection.creatorId;
    const authorId = item.video?.authorId || null;
    const hasSeparateAuthor = Boolean(authorId && authorId !== creatorId);

    const fees = calcNftSaleFees({
      priceStars: bidAmount,
      platformFeeBps,
      royaltyBps: item.collection.royaltyBps,
      creatorRoyaltySharePct: item.collection.creatorRoyaltySharePct,
      hasSeparateAuthor,
    });

    // Transfer ownership to winner.
    const moved = await tx.nftItem.updateMany({ where: { id: item.id, ownerId: auction.sellerId }, data: { ownerId: highest.bidderId } });
    if (moved.count !== 1) throw new Error("RACE_OWNER_CHANGED");

    const sale = await tx.nftSale.create({
      data: {
        itemId: item.id,
        buyerId: highest.bidderId,
        sellerId: auction.sellerId,
        priceStars: bidAmount,
        platformFeeStars: fees.platformFeeStars,
        royaltyStars: fees.royaltyStars,
        creatorRoyaltyStars: fees.creatorRoyaltyStars,
        authorRoyaltyStars: fees.authorRoyaltyStars,
        sellerProceedsStars: fees.sellerProceedsStars,
        auctionId: auction.id,
      },
    });

    // Mark hold as settled (do NOT release back to bidder).
    if (highest.holdId) {
      await tx.starHold.updateMany({ where: { id: highest.holdId, status: "HELD" }, data: { status: "SETTLED" } });
      await tx.starTransaction.create({
        data: {
          userId: highest.bidderId,
          type: "NFT_SALE",
          delta: 0,
          stars: 0,
          quantity: 1,
          note: `Auction settled (auction=${auction.id}) sale=${sale.id} bid=${highest.id} amount=${bidAmount} (held stars consumed)`,
        },
      });
    }

    // Determine if we must hold the creator's first UNVERIFIED sale proceeds.
    const prevSales = await tx.nftSale.count({ where: { itemId: item.id } });
    const isFirstSale = prevSales === 1; // includes this sale
    const holdFirstUnverified =
      isFirstSale && item.verificationStatus === "UNVERIFIED" && auction.sellerId === creatorId && holdDays > 0;

    const credits = new Map<string, number>();

    // Seller proceeds
    if (fees.sellerProceedsStars > 0) credits.set(auction.sellerId, (credits.get(auction.sellerId) || 0) + fees.sellerProceedsStars);

    // Royalty to creator
    if (fees.creatorRoyaltyStars > 0) credits.set(creatorId, (credits.get(creatorId) || 0) + fees.creatorRoyaltyStars);

    // Royalty to author
    if (authorId && fees.authorRoyaltyStars > 0) credits.set(authorId, (credits.get(authorId) || 0) + fees.authorRoyaltyStars);

    // Platform fee to treasury or seller
    if (treasuryUserId && fees.platformFeeStars > 0) {
      await tx.user.update({ where: { id: treasuryUserId }, data: { starBalance: { increment: fees.platformFeeStars } } }).catch(() => null);
      await tx.starTransaction.create({
        data: {
          userId: treasuryUserId,
          type: "ADMIN_GRANT",
          delta: fees.platformFeeStars,
          stars: fees.platformFeeStars,
          quantity: 1,
          note: `Treasury: platform fee from NFT auction sale ${sale.id} (auction=${auction.id})`,
        },
      }).catch(() => null);
    } else if (!treasuryUserId && fees.platformFeeStars > 0) {
      credits.set(auction.sellerId, (credits.get(auction.sellerId) || 0) + fees.platformFeeStars);
    }

    // Apply proceeds hold if required.
    if (holdFirstUnverified) {
      const sellerCredit = credits.get(auction.sellerId) || 0;
      if (sellerCredit > 0) {
        credits.delete(auction.sellerId);
        const releaseAt = addDays(new Date(), holdDays);
        const hold = await tx.starHold.create({
          data: {
            userId: auction.sellerId,
            amountStars: sellerCredit,
            status: "HELD",
            reason: "NFT_FIRST_UNVERIFIED_SALE_HOLD",
            refType: "NftSale",
            refId: sale.id,
            releaseAt,
          },
          select: { id: true },
        });

        await tx.starTransaction.create({
          data: {
            userId: auction.sellerId,
            type: "NFT_SALE",
            delta: 0,
            stars: 0,
            quantity: 1,
            note: `NFT auction sale ${sale.id}: proceeds held (${sellerCredit} stars) until ${releaseAt.toISOString()} (hold=${hold.id})`,
          },
        });
      }
    }

    for (const [uid, amount] of credits.entries()) {
      if (amount <= 0) continue;
      await tx.user.update({ where: { id: uid }, data: { starBalance: { increment: amount } } });
      const incomeTx = await tx.starTransaction.create({
        data: {
          userId: uid,
          type: "NFT_SALE",
          delta: amount,
          stars: amount,
          quantity: 1,
          note: `NFT auction sale ${sale.id} (auction=${auction.id})`,
        },
        select: { id: true },
      });

      await applyReferralBonusTx(tx as any, {
        referredUserId: uid,
        baseStars: amount,
        sourceKind: "EARN",
        sourceId: incomeTx.id,
        baseStarTxId: incomeTx.id,
      });
    }

    await tx.nftEventLog.create({
      data: {
        actorId: userId,
        action: "NFT_AUCTION_SETTLED",
        dataJson: JSON.stringify({ auctionId: auction.id, saleId: sale.id, winnerId: highest.bidderId, amountStars: bidAmount }),
      },
    });
  });

  redirect(back);
}
