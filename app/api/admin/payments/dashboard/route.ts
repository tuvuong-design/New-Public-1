import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const FAIL_STATUSES = new Set(["FAILED", "NEEDS_REVIEW", "UNMATCHED"]);
const SUCCESS_STATUSES = new Set(["CONFIRMED", "CREDITED"]);

function floorToBucket(d: Date, bucketMinutes: number) {
  const ms = bucketMinutes * 60 * 1000;
  return new Date(Math.floor(d.getTime() / ms) * ms);
}

function safeDecimalToNumber(v: any) {
  try {
    if (v == null) return 0;
    return Number(v.toString());
  } catch {
    return 0;
  }
}

export async function GET(req: Request) {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") || Date.now() - 24 * 60 * 60 * 1000);
  const to = new Date(url.searchParams.get("to") || Date.now());
  const chain = url.searchParams.get("chain") || "";
  const asset = (url.searchParams.get("asset") || "").trim().toUpperCase();

  const where: any = {
    createdAt: { gte: from, lte: to },
  };
  if (chain) where.chain = chain;

  const deposits = await prisma.starDeposit.findMany({
    where,
    select: {
      id: true,
      chain: true,
      status: true,
      provider: true,
      failureReason: true,
      createdAt: true,
      creditedAt: true,
      expectedAmount: true,
      actualAmount: true,
      token: { select: { symbol: true } },
      user: { select: { id: true, email: true } },
      package: { select: { stars: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const filteredDeposits = asset ? deposits.filter((d) => (d.token?.symbol || "") === asset) : deposits;

  // 15m bucketed time-series for fail-rate/volume/amount
  const bucketMinutes = 15;
  const bucketMap = new Map<string, any>();
  const chainsSet = new Set<string>();

  for (const d of filteredDeposits) {
    const b = floorToBucket(d.createdAt, bucketMinutes);
    const key = b.toISOString();
    const row = bucketMap.get(key) || { t: key, volume: 0, amountSum: 0 };

    row.volume += 1;

    const c = String(d.chain);
    chainsSet.add(c);

    // amountSum: sum expected (for consistent comparison)
    const ex = safeDecimalToNumber(d.expectedAmount);
    row.amountSum += ex;

    row[`${c}_total`] = (row[`${c}_total`] || 0) + 1;
    if (FAIL_STATUSES.has(String(d.status))) {
      row[`${c}_failed`] = (row[`${c}_failed`] || 0) + 1;
    }

    bucketMap.set(key, row);
  }

  const chainsArr = Array.from(chainsSet).sort();
  const buckets = Array.from(bucketMap.values())
    .sort((a, b) => String(a.t).localeCompare(String(b.t)))
    .map((r) => {
      for (const c of chainsArr) {
        const total = r[`${c}_total`] || 0;
        const failed = r[`${c}_failed`] || 0;
        r[`${c}_failRate`] = total > 0 ? (failed / total) * 100 : 0;
      }
      r.amountSum = Number((r.amountSum || 0).toFixed(6));
      return r;
    });

  // Provider accuracy report (failed deposits / total) in range
  const providerAgg = new Map<string, { provider: string; total: number; failed: number }>();
  for (const d of filteredDeposits) {
    const p = String(d.provider);
    const cur = providerAgg.get(p) || { provider: p, total: 0, failed: 0 };
    cur.total += 1;
    if (FAIL_STATUSES.has(String(d.status))) cur.failed += 1;
    providerAgg.set(p, cur);
  }
  const providerAccuracy = Array.from(providerAgg.values())
    .map((x) => ({ ...x, failRate: x.total > 0 ? x.failed / x.total : 0 }))
    .sort((a, b) => b.total - a.total);

  // Breakdown by asset symbol (filtered)
  const assetAgg = new Map<string, { asset: string; total: number; failed: number }>();
  for (const d of filteredDeposits) {
    const sym = d.token?.symbol || "(none)";
    const cur = assetAgg.get(sym) || { asset: sym, total: 0, failed: 0 };
    cur.total += 1;
    if (FAIL_STATUSES.has(String(d.status))) cur.failed += 1;
    assetAgg.set(sym, cur);
  }
  const breakdownAsset = Array.from(assetAgg.values())
    .map((x) => ({ ...x, failRate: x.total > 0 ? x.failed / x.total : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 50);

  // Token totals per symbol (expected sum + confirmed/credited actual sum)
  const tokenTotalsAgg = new Map<
    string,
    { asset: string; deposits: number; expectedSum: number; actualSum: number; successDeposits: number }
  >();
  for (const d of filteredDeposits) {
    const sym = d.token?.symbol || "(none)";
    const cur = tokenTotalsAgg.get(sym) || {
      asset: sym,
      deposits: 0,
      expectedSum: 0,
      actualSum: 0,
      successDeposits: 0,
    };
    cur.deposits += 1;
    cur.expectedSum += safeDecimalToNumber(d.expectedAmount);
    if (SUCCESS_STATUSES.has(String(d.status))) {
      cur.successDeposits += 1;
      cur.actualSum += safeDecimalToNumber(d.actualAmount) || safeDecimalToNumber(d.expectedAmount);
    }
    tokenTotalsAgg.set(sym, cur);
  }
  const tokenTotals = Array.from(tokenTotalsAgg.values())
    .map((x) => ({
      ...x,
      expectedSum: Number(x.expectedSum.toFixed(6)),
      actualSum: Number(x.actualSum.toFixed(6)),
    }))
    .sort((a, b) => b.deposits - a.deposits);

  // Top failing reasons (filtered)
  const reasonAgg = new Map<string, number>();
  for (const d of filteredDeposits) {
    if (!FAIL_STATUSES.has(String(d.status))) continue;
    const reason = d.failureReason || "(unknown)";
    reasonAgg.set(reason, (reasonAgg.get(reason) || 0) + 1);
  }
  const topFailReasons = Array.from(reasonAgg.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Top users causing failures
  const userFailAgg = new Map<string, { userId: string; email: string | null; count: number }>();
  for (const d of filteredDeposits) {
    if (!FAIL_STATUSES.has(String(d.status))) continue;
    if (!d.user) continue;
    const cur = userFailAgg.get(d.user.id) || { userId: d.user.id, email: d.user.email || null, count: 0 };
    cur.count += 1;
    userFailAgg.set(d.user.id, cur);
  }
  const topFailUsers = Array.from(userFailAgg.values()).sort((a, b) => b.count - a.count).slice(0, 20);

  // Stars credited (TOPUP transactions) - time-series + leaderboard
  const starTx = await prisma.starTransaction.findMany({
    where: {
      type: "TOPUP",
      depositId: { not: null },
      createdAt: { gte: from, lte: to },
    },
    select: {
      stars: true,
      createdAt: true,
      user: { select: { id: true, email: true } },
      deposit: { select: { chain: true, token: { select: { symbol: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const filteredStarTx = starTx.filter((t) => {
    if (chain && String(t.deposit?.chain || "") !== chain) return false;
    if (asset && String(t.deposit?.token?.symbol || "").toUpperCase() !== asset) return false;
    return true;
  });

  const starBucketMap = new Map<string, { t: string; starsSum: number; txCount: number }>();
  let totalStars = 0;
  for (const t of filteredStarTx) {
    const stars = Number(t.stars || 0);
    totalStars += stars;
    const b = floorToBucket(t.createdAt, bucketMinutes);
    const key = b.toISOString();
    const row = starBucketMap.get(key) || { t: key, starsSum: 0, txCount: 0 };
    row.starsSum += stars;
    row.txCount += 1;
    starBucketMap.set(key, row);
  }
  const starsBuckets = Array.from(starBucketMap.values()).sort((a, b) => String(a.t).localeCompare(String(b.t)));

  const starUserAgg = new Map<string, { userId: string; email: string | null; starsSum: number; txCount: number }>();
  for (const t of filteredStarTx) {
    const u = t.user;
    if (!u) continue;
    const cur = starUserAgg.get(u.id) || { userId: u.id, email: u.email || null, starsSum: 0, txCount: 0 };
    cur.starsSum += Number(t.stars || 0);
    cur.txCount += 1;
    starUserAgg.set(u.id, cur);
  }
  const topStarUsers = Array.from(starUserAgg.values()).sort((a, b) => b.starsSum - a.starsSum).slice(0, 20);

  const starsCredited = {
    totalStars,
    txCount: filteredStarTx.length,
    buckets: starsBuckets,
    topUsers: topStarUsers,
  };

  // Ledger audit (idempotency/double-credit/mismatch quick checks)
  const assetUpper = asset ? asset.toUpperCase() : "";
  const [creditedWithoutTx, txWithoutDeposit, doubleCreditDeposits] = await Promise.all([
    prisma.$queryRaw<{ c: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*) as c
        FROM StarDeposit d
        LEFT JOIN StarTransaction t ON t.depositId = d.id
        WHERE d.status = 'CREDITED'
          AND d.createdAt BETWEEN ${from} AND ${to}
          ${chain ? Prisma.sql`AND d.chain = ${chain}` : Prisma.empty}
          ${assetUpper ? Prisma.sql`AND EXISTS (SELECT 1 FROM StarToken tok WHERE tok.id = d.tokenId AND UPPER(tok.symbol) = ${assetUpper})` : Prisma.empty}
          AND t.id IS NULL
      `,
    ).then((rows) => Number(rows?.[0]?.c || 0)).catch(() => 0),
    prisma.$queryRaw<{ c: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*) as c
        FROM StarTransaction t
        LEFT JOIN StarDeposit d ON d.id = t.depositId
        WHERE t.type = 'TOPUP'
          AND t.depositId IS NOT NULL
          AND t.createdAt BETWEEN ${from} AND ${to}
          AND d.id IS NULL
      `,
    ).then((rows) => Number(rows?.[0]?.c || 0)).catch(() => 0),
    prisma.$queryRaw<{ c: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*) as c
        FROM (
          SELECT depositId
          FROM StarTransaction
          WHERE type = 'TOPUP'
            AND depositId IS NOT NULL
            AND createdAt BETWEEN ${from} AND ${to}
          GROUP BY depositId
          HAVING COUNT(*) > 1
        ) x
      `,
    ).then((rows) => Number(rows?.[0]?.c || 0)).catch(() => 0),
  ]);

  const ledgerAudit = {
    creditedDepositsMissingTx: creditedWithoutTx,
    topupTxMissingDeposit: txWithoutDeposit,
    doubleCreditDeposits,
  };

  return Response.json({
    buckets,
    chains: chainsArr,
    providerAccuracy,
    breakdownAsset,
    tokenTotals,
    topFailReasons,
    topFailUsers,
    starsCredited,
    ledgerAudit,
  });
}
