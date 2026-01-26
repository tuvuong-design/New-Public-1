export type NftFeeBreakdown = {
  priceStars: number;
  platformFeeStars: number;
  royaltyStars: number;
  creatorRoyaltyStars: number;
  authorRoyaltyStars: number;
  sellerProceedsStars: number;
};

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/**
 * Internal marketplace fee breakdown.
 * - Platform fee: configured bps (default 100 = 1%).
 * - Royalty: collection royalty bps (0-1000 bps).
 * - Creator/author split: creator gets X% of royalty, remainder goes to author.
 * - All rounding uses Math.floor to avoid over-charging.
 */
export function calcNftSaleFees(args: {
  priceStars: number;
  platformFeeBps: number;
  royaltyBps: number;
  creatorRoyaltySharePct: number;
  hasSeparateAuthor: boolean;
}): NftFeeBreakdown {
  const priceStars = clampInt(args.priceStars, 0, 1_000_000_000);
  const platformFeeBps = clampInt(args.platformFeeBps, 0, 10_000);
  const royaltyBps = clampInt(args.royaltyBps, 0, 10_000);
  const creatorRoyaltySharePct = clampInt(args.creatorRoyaltySharePct, 0, 100);

  const platformFeeStars = Math.floor((priceStars * platformFeeBps) / 10_000);
  const royaltyStars = Math.floor((priceStars * royaltyBps) / 10_000);

  // If there is no author (or author == creator), everything goes to creator.
  let creatorRoyaltyStars = royaltyStars;
  let authorRoyaltyStars = 0;
  if (args.hasSeparateAuthor) {
    creatorRoyaltyStars = Math.floor((royaltyStars * creatorRoyaltySharePct) / 100);
    authorRoyaltyStars = royaltyStars - creatorRoyaltyStars;
  }

  const sellerProceedsStars = Math.max(0, priceStars - platformFeeStars - royaltyStars);

  return {
    priceStars,
    platformFeeStars,
    royaltyStars,
    creatorRoyaltyStars,
    authorRoyaltyStars,
    sellerProceedsStars,
  };
}
