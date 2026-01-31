import type { Chain, Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { env } from "../../env";
import { getPaymentConfigCached } from "./paymentConfig";
import { jsonRpc, hexToBigInt, topicToAddress } from "./rpc";
import { evaluateStarsCreditRisk } from "./risk";
import { applyReferralBonusTx } from "../../lib/referrals";
import { sendTelegramWorker, fmtDepositAlertTitle } from "../../lib/notify/telegram";

const ERC20_TRANSFER_TOPIC0 = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function isEvm(chain: Chain) {
  return chain === "ETHEREUM" || chain === "POLYGON" || chain === "BSC" || chain === "BASE";
}

function rpcUrlForChain(chain: Chain): string {
  switch (chain) {
    case "SOLANA":
      return env.SOLANA_RPC_URL;
    case "ETHEREUM":
      return env.EVM_RPC_URL_ETHEREUM;
    case "POLYGON":
      return env.EVM_RPC_URL_POLYGON;
    case "BSC":
      return env.EVM_RPC_URL_BSC;
    case "BASE":
      return env.EVM_RPC_URL_BASE;
    default:
      return "";
  }
}

function decimalsToNumberStr(amount: bigint, decimals: number): string {
  if (decimals <= 0) return amount.toString();
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const frac = amount % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

async function getEvmTransferTo(
  chain: Chain,
  txHash: string,
  toAddress: string,
  tokenContract: string | null,
  tokenDecimals: number,
): Promise<string | null> {
  const url = rpcUrlForChain(chain);
  if (!url) return null;

  const receipt = await jsonRpc<any>(url, "eth_getTransactionReceipt", [txHash]);
  if (!receipt) return null;

  const toLower = toAddress.toLowerCase();

  if (!tokenContract) {
    // Native transfer: use transaction value and to.
    const tx = await jsonRpc<any>(url, "eth_getTransactionByHash", [txHash]);
    if (!tx) return null;
    if ((tx.to || "").toLowerCase() !== toLower) return null;
    const value = hexToBigInt(tx.value);
    return decimalsToNumberStr(value, 18);
  }

  const contractLower = tokenContract.toLowerCase();
  const logs: any[] = Array.isArray(receipt.logs) ? receipt.logs : [];
  let sum = 0n;

  for (const l of logs) {
    if ((l.address || "").toLowerCase() !== contractLower) continue;
    const topics: string[] = l.topics || [];
    if (!topics.length) continue;
    if ((topics[0] || "").toLowerCase() !== ERC20_TRANSFER_TOPIC0) continue;
    if (topics.length < 3) continue;
    const to = topicToAddress(topics[2]).toLowerCase();
    if (to !== toLower) continue;
    const data = (l.data || "0x0") as string;
    sum += hexToBigInt(data);
  }

  if (sum === 0n) return null;
  return decimalsToNumberStr(sum, tokenDecimals);
}

async function getSolanaTransferTo(
  txHash: string,
  toAddress: string,
  tokenMint: string | null,
  expectedMemo?: string | null,
): Promise<string | null> {
  if (!env.SOLANA_RPC_URL) return null;
  const result = await jsonRpc<any>(env.SOLANA_RPC_URL, "getTransaction", [txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
  if (!result) return null;


  // Optional memo check (Solana often uses memo=depositId to disambiguate)
  if (expectedMemo) {
    const ix: any[] = result?.transaction?.message?.instructions || [];
    let memo: string | null = null;
    for (const ins of ix) {
      const parsed = ins?.parsed;
      if (parsed && typeof parsed === "object") {
        const m = parsed?.info?.memo ?? parsed?.memo;
        if (typeof m === "string" && m.length) { memo = m; break; }
      } else if (typeof parsed === "string" && parsed.length) { memo = parsed; break; }
    }
    if (memo !== expectedMemo) return null;
  }

  const to = toAddress;
  if (!tokenMint) {
    // Native SOL delta
    const keys: any[] = result?.transaction?.message?.accountKeys || [];
    const pubkeys: string[] = keys.map((k: any) => (typeof k === "string" ? k : k.pubkey)).filter(Boolean);
    const idx = pubkeys.findIndex((k) => k === to);
    if (idx < 0) return null;
    const pre = BigInt((result?.meta?.preBalances || [])[idx] || 0);
    const post = BigInt((result?.meta?.postBalances || [])[idx] || 0);
    const delta = post - pre;
    if (delta <= 0n) return null;
    // lamports -> SOL
    return decimalsToNumberStr(delta, 9);
  }

  const preTB: any[] = result?.meta?.preTokenBalances || [];
  const postTB: any[] = result?.meta?.postTokenBalances || [];

  // Sum token balance delta for all token accounts owned by toAddress for this mint.
  const byKey = (arr: any[]) => {
    const m = new Map<string, any>();
    for (const it of arr) {
      const owner = it.owner || it?.uiTokenAmount?.owner;
      const mint = it.mint;
      const accountIndex = String(it.accountIndex);
      if (mint === tokenMint && owner === to) {
        m.set(accountIndex, it);
      }
    }
    return m;
  };

  const pre = byKey(preTB);
  const post = byKey(postTB);

  let delta = 0;
  for (const [idx, p] of post.entries()) {
    const postAmt = Number(p?.uiTokenAmount?.uiAmountString ?? p?.uiTokenAmount?.uiAmount ?? 0);
    const preAmt = Number(pre.get(idx)?.uiTokenAmount?.uiAmountString ?? pre.get(idx)?.uiTokenAmount?.uiAmount ?? 0);
    if (Number.isFinite(postAmt) && Number.isFinite(preAmt)) delta += postAmt - preAmt;
  }

  if (delta <= 0) return null;
  return String(delta);
}

async function creditIfPossible(depositId: string) {
  let notify: { message: string } | null = null;
  await prisma.$transaction(async (tx) => {
    const dep = await tx.starDeposit.findUnique({
      where: { id: depositId },
      include: { package: true, user: true, coupon: true },
    });
    if (!dep) return;
    if (!dep.userId) return;
    if (dep.status === "CREDITED" || dep.status === "REFUNDED") return;

    const baseStars = Math.max(0, Math.trunc(Number(dep.package?.stars ?? 0)));
    if (baseStars <= 0) return;

    const bundleBonusStars = Math.max(0, Math.trunc(Number((dep.package as any)?.bonusStars ?? 0)));

    // Best-effort coupon bonus for TOPUP.
    let couponBonusStars = 0;
    let couponCode = dep.couponCode || null;
    if (dep.couponId && dep.coupon && couponCode) {
      const now = new Date();
      const c = dep.coupon;
      const active = c.active && (!c.startsAt || c.startsAt <= now) && (!c.endsAt || c.endsAt >= now) && (c.appliesTo === "TOPUP" || c.appliesTo === "ANY");
      if (active) {
        const kind = c.kind as any;
        const val = Number(c.value) || 0;
        if (kind === "PERCENT") couponBonusStars = Math.floor((baseStars * val) / 100);
        else couponBonusStars = Math.floor(val);
        couponBonusStars = Math.max(0, couponBonusStars);
      } else {
        couponBonusStars = 0;
      }
    }

    const totalCredited = baseStars + bundleBonusStars + couponBonusStars;

    // Anti-fraud: rule-based risk checks.
    const risk = await evaluateStarsCreditRisk({ userId: dep.userId, stars: totalCredited });
    if (!risk.ok) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "NEEDS_REVIEW", failureReason: `risk_${risk.reason}` } });
      await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "RISK_REVIEW", message: `Risk rule triggered: ${risk.reason}` } });
      notify = { message: `${fmtDepositAlertTitle("Deposit cần kiểm tra (Risk)")}\nDeposit: ${dep.id}\nUser: ${dep.userId}\nReason: risk_${risk.reason}` };
      return;
    }

    // Idempotency per depositId+type
    const existingTopup = await tx.starTransaction.findUnique({
      where: { depositId_type: { depositId: dep.id, type: "TOPUP" } },
      select: { id: true },
    }).catch(() => null);

    let topupTxId = existingTopup?.id || null;
    if (!topupTxId) {
      await tx.user.update({ where: { id: dep.userId }, data: { starBalance: { increment: baseStars } } });
      const baseTx = await tx.starTransaction.create({
        data: {
          userId: dep.userId,
          type: "TOPUP",
          delta: baseStars,
          stars: baseStars,
          quantity: 1,
          depositId: dep.id,
          note: `Auto-credit from deposit ${dep.id}`,
        },
        select: { id: true },
      });
      topupTxId = baseTx.id;
    }

    if (bundleBonusStars > 0) {
      const existing = await tx.starTransaction.findUnique({
        where: { depositId_type: { depositId: dep.id, type: "BUNDLE_BONUS" } },
        select: { id: true },
      }).catch(() => null);
      if (!existing) {
        await tx.user.update({ where: { id: dep.userId }, data: { starBalance: { increment: bundleBonusStars } } });
        await tx.starTransaction.create({
          data: {
            userId: dep.userId,
            type: "BUNDLE_BONUS",
            delta: bundleBonusStars,
            stars: bundleBonusStars,
            quantity: 1,
            depositId: dep.id,
            discountReason: "BUNDLE_BONUS",
            note: JSON.stringify({ v: 1, kind: "BUNDLE_BONUS", depositId: dep.id, baseStars, bundleBonusStars }),
          },
        });
      }
    }

    if (couponBonusStars > 0 && dep.couponId && couponCode) {
      const existing = await tx.starTransaction.findUnique({
        where: { depositId_type: { depositId: dep.id, type: "COUPON_BONUS" } },
        select: { id: true },
      }).catch(() => null);
      if (!existing) {
        // Ensure redemption limits (best-effort; idempotent by couponId+sourceKind+sourceId)
        const perUserOk = await tx.couponRedemption.count({ where: { couponId: dep.couponId, userId: dep.userId } });
        const totalOk = await tx.couponRedemption.count({ where: { couponId: dep.couponId } });
        const c = dep.coupon;
        const maxTotal = c?.maxRedemptionsTotal ?? null;
        const maxPer = c?.maxRedemptionsPerUser ?? null;
        const allow = (maxTotal == null || totalOk < maxTotal) && (maxPer == null || perUserOk < maxPer);
        if (allow) {
          await tx.couponRedemption.create({
            data: {
              couponId: dep.couponId,
              userId: dep.userId,
              sourceKind: "TOPUP",
              sourceId: dep.id,
              starsBonus: couponBonusStars,
              starsDiscount: 0,
            },
          }).catch(() => null);

          await tx.user.update({ where: { id: dep.userId }, data: { starBalance: { increment: couponBonusStars } } });
          await tx.starTransaction.create({
            data: {
              userId: dep.userId,
              type: "COUPON_BONUS",
              delta: couponBonusStars,
              stars: couponBonusStars,
              quantity: 1,
              depositId: dep.id,
              discountReason: `COUPON:${couponCode}`.slice(0, 60),
              note: JSON.stringify({ v: 1, kind: "COUPON_BONUS", depositId: dep.id, couponId: dep.couponId, couponCode, baseStars, couponBonusStars }),
            },
          });
        } else {
          await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "COUPON_SKIPPED", message: `Coupon limit reached for ${couponCode}` } });
        }
      }
    }

    // Referral bonus based on total credited preview (base + bonuses)
    await applyReferralBonusTx(tx as any, {
      referredUserId: dep.userId,
      baseStars: totalCredited,
      sourceKind: "TOPUP",
      sourceId: dep.id,
      baseStarTxId: topupTxId || undefined,
    }).catch(() => null);

    await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "CREDITED", creditedAt: dep.creditedAt || new Date() } });
    await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "AUTO_CREDIT", message: `Credited ${totalCredited} stars (base=${baseStars}, bundle=${bundleBonusStars}, coupon=${couponBonusStars})` } });

    notify = {
      message: `${fmtDepositAlertTitle("Nạp sao thành công")}\nDeposit: ${dep.id}\nUser: ${dep.userId}\nChain: ${dep.chain}\nToken: ${(dep as any).tokenId ?? ""}\nTx: ${(dep as any).txHash ?? ""}\n+Stars: ${totalCredited}`,
    };
  });
}


function withinTolerance(expected: number, actual: number, toleranceBps: number): boolean {
  if (!Number.isFinite(expected) || !Number.isFinite(actual) || expected <= 0) return false;
  const tol = (expected * toleranceBps) / 10000;
  return Math.abs(actual - expected) <= tol;
}

export async function reconcileDepositJob(depositId: string) {
  const cfg = await getPaymentConfigCached();

  const dep = await prisma.starDeposit.findUnique({
    where: { id: depositId },
    include: { token: true, custodialAddress: true },
  });
  if (!dep) return;

  if (dep.status === "CREDITED" || dep.status === "REFUNDED") return;
  if (!dep.txHash) {
    await prisma.starDeposit.update({ where: { id: dep.id }, data: { failureReason: "missing_txHash", status: dep.status === "CREATED" ? "CREATED" : "FAILED" } });
    return;
  }

  const chain = dep.chain;
  const txHash = dep.txHash;

  let actualStr: string | null = dep.actualAmount ? dep.actualAmount.toString() : null;

  try {
    if (!actualStr) {
      if (chain === "SOLANA") {
        const mint = dep.token?.contractAddress ?? null;
        actualStr = await getSolanaTransferTo(txHash, dep.custodialAddress.address, mint, dep.memo);
      } else if (isEvm(chain)) {
        const tokenContract = dep.token?.contractAddress ?? null;
        const decimals = dep.token?.decimals ?? 18;
        actualStr = await getEvmTransferTo(chain, txHash, dep.custodialAddress.address, tokenContract, decimals);
      } else if (chain === "TRON") {
        // Prefer webhook-provided actualAmount. Full Tron verification requires provider-specific APIs.
        actualStr = dep.actualAmount ? dep.actualAmount.toString() : null;
      }
    }

    if (!actualStr) {
      await prisma.starDeposit.update({
        where: { id: dep.id },
        data: { status: "FAILED", failureReason: `cannot_verify_${chain}` },
      });
      await prisma.starDepositEvent.create({ data: { depositId: dep.id, type: "RECONCILE_FAILED", message: `Cannot verify on-chain for ${chain}` } });
      return;
    }

    const expected = Number(dep.expectedAmount);
    const actual = Number(actualStr);

    if (!withinTolerance(expected, actual, cfg.toleranceBps)) {
      await prisma.starDeposit.update({
        where: { id: dep.id },
        data: { status: "NEEDS_REVIEW", actualAmount: new Prisma.Decimal(actualStr), failureReason: `tolerance_exceeded_${cfg.toleranceBps}bps` },
      });
      await prisma.starDepositEvent.create({
        data: {
          depositId: dep.id,
          type: "AMOUNT_MISMATCH",
          message: `Expected ${expected} got ${actualStr} (tolerance ${cfg.toleranceBps}bps)`,
        },
      });
      await sendTelegramWorker(`${fmtDepositAlertTitle("Deposit cần kiểm tra (Amount mismatch)")}\nDeposit: ${dep.id}\nChain: ${dep.chain}\nTx: ${dep.txHash ?? ""}\nExpected: ${expected}\nActual: ${actualStr}\nToleranceBps: ${cfg.toleranceBps}`).catch(() => null);
      return;
    }

    await prisma.starDeposit.update({
      where: { id: dep.id },
      data: { status: "CONFIRMED", actualAmount: new Prisma.Decimal(actualStr), failureReason: null },
    });
    await prisma.starDepositEvent.create({
      data: { depositId: dep.id, type: "RECONCILE_CONFIRMED", message: `Confirmed amount ${actualStr}` },
    });

    // Auto-credit
    await creditIfPossible(dep.id);
  } catch (e: any) {
    await prisma.starDeposit.update({
      where: { id: dep.id },
      data: { status: "FAILED", failureReason: `reconcile_error_${String(e?.message || e).slice(0, 200)}` },
    });
    await prisma.starDepositEvent.create({ data: { depositId: dep.id, type: "RECONCILE_ERROR", message: String(e?.message || e).slice(0, 500) } });
  }
}