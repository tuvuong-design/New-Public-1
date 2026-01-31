import type { Chain, PaymentProvider } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/api/crypto";
import { extractObservations } from "@/lib/payments/extractObservations";
import { creditDepositStars } from "@/lib/payments/credit";
import { sendTelegram } from "@/lib/notify/telegram";

/**
 * Webhook bảo mật:
 * - Provider (Helius/Alchemy/Trongrid/...) gọi vào endpoint của bạn
 * - Bạn kiểm tra header x-webhook-secret === CRYPTO_WEBHOOK_SECRET
 * - Ghi log WebhookAuditLog (dedupe theo provider+sha256)
 * - Parse payload -> observation -> match StarDeposit -> update status -> auto-credit
 */

export type ProcessWebhookInput = {
  provider: PaymentProvider;
  chain: Chain;
  endpoint: string;
  ip?: string | null;
  headers?: Record<string, string | string[] | undefined>;
  payload: any;
};

function isEvm(chain: Chain) {
  return chain === "ETHEREUM" || chain === "POLYGON" || chain === "BSC" || chain === "BASE";
}

function normAddr(chain: Chain, addr: string) {
  const a = (addr || "").trim();
  return isEvm(chain) ? a.toLowerCase() : a;
}

function pickStableSymbol(sym?: string | null) {
  const s = (sym || "").toUpperCase().trim();
  return s === "USDT" || s === "USDC" ? (s as "USDT" | "USDC") : null;
}

async function findToken(chain: Chain, tokenContract?: string | null, assetSymbol?: string | null) {
  // Chỉ cho phép USDT/USDC (đúng yêu cầu)
  const stable = pickStableSymbol(assetSymbol || undefined);

  if (tokenContract) {
    const norm = isEvm(chain) ? tokenContract.toLowerCase() : tokenContract;
    const t = await prisma.token.findFirst({ where: { chain, contractAddress: norm, active: true } });
    if (t) {
      if (!stable) return t.symbol.toUpperCase() === "USDT" || t.symbol.toUpperCase() === "USDC" ? t : null;
      return t.symbol.toUpperCase() === stable ? t : null;
    }
    // fallback: if token contract unknown but assetSymbol is stable, try by symbol
    if (stable) {
      return prisma.token.findFirst({ where: { chain, symbol: stable, active: true } });
    }
    return null;
  }

  if (stable) {
    return prisma.token.findFirst({ where: { chain, symbol: stable, active: true } });
  }
  return null;
}

async function matchDeposit(params: {
  chain: Chain;
  tokenId: string;
  txHash?: string;
  memo?: string;
  toAddress?: string;
}): Promise<{ depositId: string } | null> {
  const { chain, tokenId, txHash, memo, toAddress } = params;

  if (txHash) {
    const byTx = await prisma.starDeposit.findFirst({
      where: { chain, txHash, tokenId },
      select: { id: true },
    });
    if (byTx) return { depositId: byTx.id };
  }

  // Solana memo = depositId (khuyến nghị)
  if (memo) {
    const byMemo = await prisma.starDeposit.findFirst({
      where: {
        chain,
        tokenId,
        OR: [{ memo }, { id: memo }],
      },
      select: { id: true },
    });
    if (byMemo) return { depositId: byMemo.id };
  }

  // Nếu không có memo: match theo địa chỉ nạp (custodial address)
  if (toAddress) {
    const normTo = normAddr(chain, toAddress);
    const addr = await prisma.custodialAddress.findFirst({
      where: { chain, address: normTo },
      select: { id: true },
    });
    if (!addr) return null;

    const dep = await prisma.starDeposit.findFirst({
      where: {
        chain,
        tokenId,
        custodialAddressId: addr.id,
        status: { in: ["CREATED", "SUBMITTED", "OBSERVED", "CONFIRMED"] as any },
        creditedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (dep) return { depositId: dep.id };
  }

  return null;
}

function shouldConfirmNow(chain: Chain) {
  // Mặc định: coi webhook là CONFIRMED (để auto-credit ngay)
  // Bạn có thể tắt auto-credit bằng PAYMENTS_AUTO_CREDIT=false
  const enabled = (process.env.PAYMENTS_AUTO_CREDIT ?? "true").toLowerCase() !== "false";
  if (!enabled) return false;

  // Nếu muốn siết theo chain: ví dụ EVM cần confirmations -> có thể cấu hình sau.
  return true;
}

function decimalFrom(n: any): Prisma.Decimal | null {
  if (n === null || n === undefined) return null;
  if (typeof n === "number" && Number.isFinite(n)) return new Prisma.Decimal(String(n));
  if (typeof n === "string" && n.trim()) return new Prisma.Decimal(n.trim());
  return null;
}

function withinToleranceBps(expected: Prisma.Decimal | null, actual: Prisma.Decimal | null, toleranceBps: number) {
  if (!expected || !actual) return true;
  try {
    const e = Number(expected.toString());
    const a = Number(actual.toString());
    if (!Number.isFinite(e) || !Number.isFinite(a) || e <= 0) return true;
    const diff = Math.abs(a - e);
    const bps = (diff / e) * 10000;
    return bps <= toleranceBps;
  } catch {
    return true;
  }
}

export async function processPaymentWebhook(input: ProcessWebhookInput) {
  const payloadJson = JSON.stringify(input.payload ?? {});
  const hash = sha256(payloadJson);

  // Dedupe theo provider+sha256
  const audit = await prisma.webhookAuditLog
    .create({
      data: {
        provider: input.provider,
        chain: input.chain,
        endpoint: input.endpoint,
        ip: input.ip || null,
        headersJson: input.headers ? JSON.stringify(input.headers) : null,
        payloadJson,
        sha256: hash,
        status: "RECEIVED",
      },
      select: { id: true },
    })
    .catch(async (e) => {
      // Unique violation => đã nhận payload này rồi
      return null;
    });

  const observations = extractObservations(input.provider, input.chain, input.payload);

  const results: any[] = [];
  for (const ob of observations) {
    const token = await findToken(input.chain, ob.tokenContract, ob.assetSymbol);
    if (!token) {
      results.push({ ok: false, reason: "TOKEN_NOT_ALLOWED", txHash: ob.txHash });
      continue;
    }

    const match = await matchDeposit({
      chain: input.chain,
      tokenId: token.id,
      txHash: ob.txHash,
      memo: ob.memo,
      toAddress: ob.toAddress,
    });

    if (!match) {
      results.push({ ok: false, reason: "DEPOSIT_NOT_FOUND", txHash: ob.txHash, memo: ob.memo, to: ob.toAddress });
      continue;
    }

    const dep = await prisma.starDeposit.findUnique({
      where: { id: match.depositId },
      include: { package: true, user: true, token: true, custodialAddress: true },
    });
    if (!dep) {
      results.push({ ok: false, reason: "DEPOSIT_NOT_FOUND", depositId: match.depositId });
      continue;
    }

    // Update basic fields
    const actual = decimalFrom(ob.amount);
    const toleranceBps = Number(process.env.PAYMENTS_TOLERANCE_BPS || 150); // 1.5% default
    const okTol = withinToleranceBps(dep.expectedAmount ?? null, actual ?? null, toleranceBps);

    // Nếu amount lệch quá nhiều so với expected => NEEDS_REVIEW
    if (!okTol) {
      await prisma.starDeposit.update({
        where: { id: dep.id },
        data: {
          status: "NEEDS_REVIEW",
          actualAmount: actual ?? dep.actualAmount,
          txHash: ob.txHash ?? dep.txHash,
          failureReason: dep.failureReason || "amount_out_of_tolerance",
        },
      });
      await prisma.starDepositEvent.create({
        data: { depositId: dep.id, type: "NEEDS_REVIEW", message: "Amount mismatch beyond tolerance", dataJson: JSON.stringify({ expected: dep.expectedAmount?.toString(), actual: actual?.toString(), toleranceBps }) },
      });
      results.push({ ok: false, reason: "NEEDS_REVIEW", depositId: dep.id });
      continue;
    }

    const confirmNow = shouldConfirmNow(input.chain);
    const nextStatus = confirmNow ? ("CONFIRMED" as const) : ("OBSERVED" as const);

    await prisma.starDeposit.update({
      where: { id: dep.id },
      data: {
        status: nextStatus,
        actualAmount: actual ?? dep.actualAmount,
        txHash: ob.txHash ?? dep.txHash,
        memo: dep.memo || ob.memo || dep.memo,
        confirmedAt: confirmNow ? (dep.confirmedAt || new Date()) : dep.confirmedAt,
      },
    });
    await prisma.starDepositEvent.create({
      data: { depositId: dep.id, type: nextStatus, message: `Webhook processed: ${nextStatus}`, dataJson: JSON.stringify({ provider: input.provider, txHash: ob.txHash, to: ob.toAddress, amount: ob.amount, token: token.symbol }) },
    });

    let creditRes: any = null;
    if (confirmNow) {
      creditRes = await creditDepositStars(dep.id, `auto-credit via webhook provider=${input.provider}`);
    }

    if (nextStatus === "NEEDS_REVIEW" || nextStatus === "UNMATCHED") {
      await sendTelegram(`⚠️ <b>Deposit ${nextStatus}</b>\nDeposit: <code>${dep.id}</code>\nChain: ${dep.chain}\nToken: ${token.symbol}\nTx: <code>${ob.txHash || ""}</code>\nTo: <code>${ob.toAddress || ""}</code>\nAmount: ${ob.amount || ""}`);
    }

    if (audit) {
      await prisma.webhookAuditLog.update({
        where: { id: audit.id },
        data: { depositId: dep.id, status: "PROCESSED" },
      }).catch(() => null);
    }

    results.push({ ok: true, depositId: dep.id, status: nextStatus, credited: creditRes?.ok ? true : false, credit: creditRes });
  }

  return { ok: true, auditId: audit?.id || null, results };
}

export function assertWebhookSecret(headerSecret: string | null | undefined) {
  const secret = process.env.CRYPTO_WEBHOOK_SECRET;
  if (!secret) return { ok: false as const, reason: "missing_server_secret" as const };
  if (!headerSecret) return { ok: false as const, reason: "missing_header_secret" as const };
  if (headerSecret !== secret) return { ok: false as const, reason: "invalid_secret" as const };
  return { ok: true as const };
}
