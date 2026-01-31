import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSiteConfig } from "@/lib/siteConfig";
import { calcNftSaleFees } from "@/lib/nft/fees";
import { releaseMaturedHoldsTx } from "@/lib/stars/holds";
import { applyReferralBonusTx } from "@/lib/referrals";
export const runtime = "nodejs";

function addDays(d: Date, days: number) {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(d.getTime() + ms);
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
    // Opportunistically release matured holds before checking balance.
    await releaseMaturedHoldsTx(tx, userId);

    const listing = await tx.nftListing.findUnique({
      where: { id: params.id },
      include: {
        item: {
          include: {
            collection: { select: { id: true, creatorId: true, royaltyBps: true, creatorRoyaltySharePct: true } },
            video: { select: { id: true, authorId: true } },
          },
        },
      },
    });

    if (!listing) throw new Error("LISTING_NOT_FOUND");
    if (listing.status !== "ACTIVE") throw new Error("LISTING_NOT_ACTIVE");
    if (listing.sellerId === userId) throw new Error("CANNOT_BUY_OWN_LISTING");

    const item = listing.item;
    if (!item) throw new Error("ITEM_NOT_FOUND");
    if (item.marketplaceFrozen || item.exportStatus !== "NONE") throw new Error("MARKETPLACE_FROZEN");
    if (item.ownerId !== listing.sellerId) throw new Error("OWNER_MISMATCH");

    const priceStars = Number(listing.priceStars) || 0;
    if (priceStars <= 0) throw new Error("INVALID_PRICE");

    const buyer = await tx.user.findUnique({ where: { id: userId }, select: { id: true, starBalance: true } });
    if (!buyer) throw new Error("BUYER_NOT_FOUND");
    if ((buyer.starBalance ?? 0) < priceStars) throw new Error("INSUFFICIENT_STARS");

    const creatorId = item.collection.creatorId;
    const authorId = item.video?.authorId || null;
    const hasSeparateAuthor = Boolean(authorId && authorId !== creatorId);

    const fees = calcNftSaleFees({
      priceStars,
      platformFeeBps,
      royaltyBps: item.collection.royaltyBps,
      creatorRoyaltySharePct: item.collection.creatorRoyaltySharePct,
      hasSeparateAuthor,
    });

    // Ensure this listing is only purchased once.
    const updatedListing = await tx.nftListing.updateMany({
      where: { id: listing.id, status: "ACTIVE" },
      data: { status: "SOLD", soldAt: new Date() },
    });
    if (updatedListing.count !== 1) throw new Error("RACE_LISTING_SOLD");

    // Deduct buyer stars.
    await tx.user.update({ where: { id: userId }, data: { starBalance: { decrement: priceStars } } });
    await tx.starTransaction.create({
      data: {
        userId,
        type: "NFT_SALE",
        delta: -priceStars,
        stars: priceStars,
        quantity: 1,
        note: `Buy NFT listing ${listing.id} (item=${item.id})`,
      },
    });

    // Transfer ownership.
    const moved = await tx.nftItem.updateMany({
      where: { id: item.id, ownerId: listing.sellerId },
      data: { ownerId: userId },
    });
    if (moved.count !== 1) throw new Error("RACE_OWNER_CHANGED");

    const sale = await tx.nftSale.create({
      data: {
        itemId: item.id,
        buyerId: userId,
        sellerId: listing.sellerId,
        priceStars,
        platformFeeStars: fees.platformFeeStars,
        royaltyStars: fees.royaltyStars,
        creatorRoyaltyStars: fees.creatorRoyaltyStars,
        authorRoyaltyStars: fees.authorRoyaltyStars,
        sellerProceedsStars: fees.sellerProceedsStars,
        listingId: listing.id,
      },
    });

    // Determine if we must hold the creator's first UNVERIFIED sale proceeds.
    const prevSales = await tx.nftSale.count({ where: { itemId: item.id } });
    const isFirstSale = prevSales === 1; // includes the sale we just created
    const holdFirstUnverified =
      isFirstSale && item.verificationStatus === "UNVERIFIED" && listing.sellerId === creatorId && holdDays > 0;

    // Credits map.
    const credits = new Map<string, number>();

    // Seller proceeds.
    if (fees.sellerProceedsStars > 0) credits.set(listing.sellerId, (credits.get(listing.sellerId) || 0) + fees.sellerProceedsStars);

    // Royalty -> creator.
    if (fees.creatorRoyaltyStars > 0) credits.set(creatorId, (credits.get(creatorId) || 0) + fees.creatorRoyaltyStars);

    // Royalty -> author.
    if (authorId && fees.authorRoyaltyStars > 0) credits.set(authorId, (credits.get(authorId) || 0) + fees.authorRoyaltyStars);

    // Platform fee -> treasury (if configured). If no treasury is set, we keep it on seller side (effectively fee=0).
    if (treasuryUserId && fees.platformFeeStars > 0) {
      await tx.user.update({ where: { id: treasuryUserId }, data: { starBalance: { increment: fees.platformFeeStars } } }).catch(() => null);
      await tx.starTransaction.create({
        data: {
          userId: treasuryUserId,
          type: "ADMIN_GRANT",
          delta: fees.platformFeeStars,
          stars: fees.platformFeeStars,
          quantity: 1,
          note: `Treasury: platform fee from NFT sale ${sale.id} (listing=${listing.id})`,
        },
      }).catch(() => null);
    } else if (!treasuryUserId && fees.platformFeeStars > 0) {
      credits.set(listing.sellerId, (credits.get(listing.sellerId) || 0) + fees.platformFeeStars);
    }

    // Apply proceeds hold if required.
    if (holdFirstUnverified) {
      const sellerCredit = credits.get(listing.sellerId) || 0;
      if (sellerCredit > 0) {
        credits.delete(listing.sellerId);
        const releaseAt = addDays(new Date(), holdDays);
        const hold = await tx.starHold.create({
          data: {
            userId: listing.sellerId,
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
            userId: listing.sellerId,
            type: "NFT_SALE",
            delta: 0,
            stars: 0,
            quantity: 1,
            note: `NFT sale ${sale.id}: proceeds held (${sellerCredit} stars) until ${releaseAt.toISOString()} (hold=${hold.id})`,
          },
        });
      }
    }

    // Apply remaining credits immediately.
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
          note: `NFT sale ${sale.id} (listing=${listing.id})`,
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
  });

  redirect(back);
}