import { NextRequest, NextResponse } from "next/server";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";
import { calcNftSaleFees } from "@/lib/nft/fees";
import { releaseMaturedHoldsTx } from "@/lib/stars/holds";
import { applyReferralBonusTx } from "@/lib/referrals";
import { verifyUserPin } from "@/lib/security/pin";

export const runtime = "nodejs";

function addDays(d: Date, days: number) {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(d.getTime() + ms);
}

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["NFT_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardExternal(req, { scopes: ["NFT_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;

  const userId = g.user!.sub;


// PIN bảo mật (nếu user đã set PIN thì bắt buộc phải nhập đúng khi mua NFT)
const body = await req.json().catch(() => ({} as any));
const pin = typeof (body as any)?.pin === "string" ? String((body as any).pin).trim() : "";
const pinRec = await prisma.userPin.findUnique({ where: { userId } });
if (pinRec) {
  if (!pin) return withCors(jsonError(400, "Thiếu mã PIN"), g.origin);
  const vr = await verifyUserPin(userId, pin);
  if (!vr.ok) return withCors(jsonError(403, vr.reason === "LOCKED" ? "PIN đang bị khoá tạm thời" : "PIN sai", vr), g.origin);
}

  const cfg = await getSiteConfig();
  const platformFeeBps = Number((cfg as any).nftPlatformFeeBps ?? 100);
  const holdDays = Number((cfg as any).nftUnverifiedFirstSaleHoldDays ?? 10);
  const treasuryUserId = (cfg as any).treasuryUserId as string | null | undefined;

  try {
    await prisma.$transaction(async (tx) => {
      // release holds
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

      const updatedListing = await tx.nftListing.updateMany({
        where: { id: listing.id, status: "ACTIVE" },
        data: { status: "SOLD", soldAt: new Date() },
      });
      if (updatedListing.count !== 1) throw new Error("RACE_LISTING_SOLD");

      await tx.user.update({ where: { id: userId }, data: { starBalance: { decrement: priceStars } } });
      await tx.starTransaction.create({
        data: { userId, type: "NFT_SALE", delta: -priceStars, stars: priceStars, quantity: 1, note: `Buy NFT listing ${listing.id}` },
      });

      const moved = await tx.nftItem.updateMany({ where: { id: item.id, ownerId: listing.sellerId }, data: { ownerId: userId } });
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

      const prevSales = await tx.nftSale.count({ where: { itemId: item.id } });
      const isFirstSale = prevSales === 1;
      const holdFirstUnverified =
        isFirstSale && item.verificationStatus === "UNVERIFIED" && listing.sellerId === creatorId && holdDays > 0;

      const credits = new Map<string, number>();
      if (fees.sellerProceedsStars > 0) credits.set(listing.sellerId, (credits.get(listing.sellerId) || 0) + fees.sellerProceedsStars);
      if (fees.creatorRoyaltyStars > 0) credits.set(creatorId, (credits.get(creatorId) || 0) + fees.creatorRoyaltyStars);
      if (fees.authorRoyaltyStars > 0 && authorId) credits.set(authorId, (credits.get(authorId) || 0) + fees.authorRoyaltyStars);

      if (fees.platformFeeStars > 0 && treasuryUserId) credits.set(treasuryUserId, (credits.get(treasuryUserId) || 0) + fees.platformFeeStars);

      // Hold logic
      for (const [uid, stars] of credits.entries()) {
        if (stars <= 0) continue;

        const shouldHold = holdFirstUnverified && uid === creatorId;
        if (shouldHold) {
          const releaseAt = addDays(new Date(), holdDays);
          await tx.starHold.create({
            data: { userId: uid, stars, reason: "NFT_FIRST_SALE_HOLD", note: `Hold first unverified sale for item ${item.id}`, releaseAt },
          });
        } else {
          await tx.user.update({ where: { id: uid }, data: { starBalance: { increment: stars } } });
        }

        await tx.starTransaction.create({
          data: { userId: uid, type: "NFT_SALE", delta: stars, stars, quantity: 1, note: `NFT sale credit (sale=${sale.id})` },
        });
      }

      // Referral bonus (best-effort)
      await applyReferralBonusTx(tx as any, userId, { type: "NFT_BUY", stars: priceStars } as any);
    });

    return withCors(NextResponse.json({ ok: true }), g.origin);
  } catch (e: any) {
    return withCors(jsonError(400, e?.message ?? "BUY_FAILED"), g.origin);
  }
}
