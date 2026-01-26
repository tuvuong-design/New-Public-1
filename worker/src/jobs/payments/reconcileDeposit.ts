import type { Chain, Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { env } from "../../env";
import { getPaymentConfigCached } from "./paymentConfig";
import { jsonRpc, hexToBigInt, topicToAddress } from "./rpc";
import { evaluateStarsCreditRisk } from "./risk";

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
): Promise<string | null> {
  if (!env.SOLANA_RPC_URL) return null;
  const result = await jsonRpc<any>(env.SOLANA_RPC_URL, "getTransaction", [txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
  if (!result) return null;

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
  await prisma.$transaction(async (tx) => {
    const dep = await tx.starDeposit.findUnique({
      where: { id: depositId },
      include: { package: true, user: true },
    });
    if (!dep) return;
    if (!dep.userId) return;
    if (dep.status === "CREDITED" || dep.status === "REFUNDED") return;

    const stars = dep.package?.stars ?? 0;
    if (!stars || stars <= 0) return;

    // Anti-fraud: rule-based risk checks.
    const risk = await evaluateStarsCreditRisk({ userId: dep.userId, stars });
    if (!risk.ok) {
      await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "NEEDS_REVIEW", failureReason: `risk_${risk.reason}` } });
      await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "RISK_REVIEW", message: `Risk rule triggered: ${risk.reason}` } });
      return;
    }

    // Prevent duplicate credit
    const existingTx = await tx.starTransaction.findFirst({ where: { depositId: dep.id } });
    if (existingTx) return;

    await tx.user.update({ where: { id: dep.userId }, data: { starBalance: { increment: stars } } });
    await tx.starTransaction.create({
      data: {
        userId: dep.userId,
        type: "TOPUP",
        delta: stars,
        stars,
        quantity: 1,
        depositId: dep.id,
        note: `Auto-credit from deposit ${dep.id}`,
      },
    });
    await tx.starDeposit.update({ where: { id: dep.id }, data: { status: "CREDITED" } });
    await tx.starDepositEvent.create({ data: { depositId: dep.id, type: "AUTO_CREDIT", message: `Credited ${stars} stars` } });
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
        actualStr = await getSolanaTransferTo(txHash, dep.custodialAddress.address, mint);
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
