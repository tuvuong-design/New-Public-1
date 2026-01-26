import { prisma } from "../../prisma";
import type { Chain, PaymentProvider, Prisma, DepositStatus } from "@prisma/client";
import { extractObservations } from "./extract";
import { getPaymentConfigCached } from "./paymentConfig";

function isEvm(chain: Chain) {
  return chain === "ETHEREUM" || chain === "POLYGON" || chain === "BSC" || chain === "BASE";
}

function normAddress(chain: Chain, addr: string): string {
  const a = addr.trim();
  if (isEvm(chain)) return a.toLowerCase();
  return a;
}

function safeNumber(n: any): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  const f = Number(n);
  return Number.isFinite(f) ? f : null;
}

async function findToken(chain: Chain, tokenContract: string | undefined | null, assetSymbol?: string | undefined) {
  if (!tokenContract) {
    // Native token: pick by symbol if exists, else first native for chain
    if (assetSymbol) {
      const bySym = await prisma.token.findFirst({ where: { chain, symbol: assetSymbol.toUpperCase(), contractAddress: null } });
      if (bySym) return bySym;
    }
    return (
      (await prisma.token.findFirst({ where: { chain, contractAddress: null, isNative: true } })) ||
      prisma.token.findFirst({ where: { chain, contractAddress: null } })
    );
  }
  const norm = isEvm(chain) ? tokenContract.toLowerCase() : tokenContract;
  const existing = await prisma.token.findFirst({ where: { chain, contractAddress: norm } });
  if (existing) return existing;

  // As a last resort, create a placeholder token so UNMATCHED deposits can still be triaged.
  // Admin can later correct symbol/decimals.
  return prisma.token.create({
    data: {
      chain,
      symbol: (assetSymbol || "UNKNOWN").toUpperCase().slice(0, 12),
      name: assetSymbol ? `${assetSymbol} Token` : "Unknown Token",
      decimals: 6,
      contractAddress: norm,
      isNative: false,
      active: false,
    },
  });
}

async function findCustodialAddress(chain: Chain, toAddress: string) {
  const norm = normAddress(chain, toAddress);
  return prisma.custodialAddress.findFirst({ where: { chain, address: norm } });
}

async function upsertDepositEvent(depositId: string, type: string, message?: string, meta?: any) {
  await prisma.starDepositEvent.create({
    data: {
      depositId,
      type,
      message,
      dataJson: meta ? JSON.stringify(meta).slice(0, 20000) : null,
    },
  });
}

function chooseCandidateStatus(current: DepositStatus): DepositStatus {
  // Keep UNMATCHED as-is so it appears in inbox.
  if (current === "UNMATCHED") return current;
  if (current === "CREDITED" || current === "REFUNDED") return current;
  // We consider we have at least observed the tx.
  return "OBSERVED";
}

export async function processWebhookAuditJob(auditLogId: string) {
  const log = await prisma.webhookAuditLog.findUnique({ where: { id: auditLogId } });
  if (!log) return;
  if (log.status === "PROCESSED") return;

  const cfg = await getPaymentConfigCached();

  let payload: any = null;
  try {
    payload = log.payloadJson ? JSON.parse(log.payloadJson) : null;
  } catch (e) {
    await prisma.webhookAuditLog.update({ where: { id: auditLogId }, data: { status: "FAILED", failureReason: "invalid_payload_json" } });
    return;
  }

  const observations = extractObservations(log.provider as PaymentProvider, log.chain as Chain, payload);
  if (!observations.length) {
    await prisma.webhookAuditLog.update({ where: { id: auditLogId }, data: { status: "FAILED", failureReason: "no_observations" } });
    return;
  }

  let linkedDepositId: string | null = null;

  for (const obs of observations) {
    const chain = obs.chain as Chain;
    const txHash = obs.txHash?.trim();
    const memo = obs.memo?.trim();
    const toAddress = obs.toAddress?.trim();

    // Strict allowlist (defense-in-depth; API routes already enforce)
    if (cfg.strictMode) {
      const allow = (cfg.allowlist?.[chain] || []) as string[];
      if (allow.length && !allow.includes(log.provider)) {
        await prisma.webhookAuditLog.update({
          where: { id: auditLogId },
          data: { status: "REJECTED", failureReason: `provider_not_allowed_${log.provider}` },
        });
        return;
      }
    }

    // 1) Match by memo depositId (Solana)
    let deposit = memo
      ? await prisma.starDeposit.findUnique({ where: { id: memo } }).catch(() => null)
      : null;

    // 2) Match by txHash
    if (!deposit && txHash) {
      deposit = await prisma.starDeposit.findFirst({ where: { txHash } }).catch(() => null);
    }

    // 3) Match by toAddress (+ amount, + token)
    if (!deposit && toAddress) {
      const custodial = await findCustodialAddress(chain, toAddress);
      if (custodial) {
        const amount = safeNumber(obs.amount);
        const token = await findToken(chain, obs.tokenContract, obs.assetSymbol);

        const candidates = await prisma.starDeposit.findMany({
          where: {
            chain,
            custodialAddressId: custodial.id,
            tokenId: token?.id,
            status: { in: ["CREATED", "SUBMITTED", "OBSERVED", "UNMATCHED"] },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: "asc" },
          take: 10,
        });

        if (amount != null && candidates.length) {
          // Pick the closest expected amount.
          let best: { dep: (typeof candidates)[number]; diff: number } | null = null;
          for (const c of candidates) {
            const exp = Number(c.expectedAmount);
            if (!Number.isFinite(exp)) continue;
            const diff = Math.abs(exp - amount);
            if (!best || diff < best.diff) best = { dep: c, diff };
          }
          if (best && best.diff <= Math.max(0.000001, (Number(best.dep.expectedAmount) * cfg.toleranceBps) / 10000)) {
            deposit = best.dep;
          }
        } else if (candidates.length === 1) {
          deposit = candidates[0];
        }

        // If still no match, create an UNMATCHED deposit so admin can assign quickly.
        if (!deposit) {
          const token2 = token;
          const expAmount = safeNumber(obs.amount) ?? 0;

          deposit = await prisma.starDeposit.create({
            data: {
              userId: null,
              chain,
              tokenId: token2 ? token2.id : undefined,
              custodialAddressId: custodial.id,
              packageId: (await prisma.starTopupPackage.findFirst({ where: { active: true }, orderBy: { sort: "asc" } }))?.id,
              expectedAmount: new Prisma.Decimal(expAmount),
              actualAmount: expAmount ? new Prisma.Decimal(expAmount) : null,
              txHash: txHash || null,
              memo: memo || null,
              provider: log.provider,
              status: "UNMATCHED",
            },
          });
          await upsertDepositEvent(deposit.id, "UNMATCHED_CREATED", `Created from webhook ${auditLogId}`, { provider: log.provider, chain, txHash, toAddress });
        }
      }
    }

    if (!deposit) {
      continue;
    }

    // Update deposit fields
    const update: Prisma.StarDepositUpdateInput = {
      provider: log.provider,
      status: chooseCandidateStatus(deposit.status),
    };
    if (txHash && !deposit.txHash) update.txHash = txHash;
    if (memo && !deposit.memo) update.memo = memo;
    if (toAddress) {
      // keep custodialAddress by ID, but we store toAddress in event
    }
    if (obs.amount != null) update.actualAmount = new Prisma.Decimal(obs.amount);

    await prisma.starDeposit.update({ where: { id: deposit.id }, data: update });
    await upsertDepositEvent(deposit.id, "WEBHOOK_OBSERVED", `Webhook ${auditLogId} (${log.provider})`, {
      provider: log.provider,
      chain,
      txHash,
      memo,
      toAddress,
      amount: obs.amount,
      tokenContract: obs.tokenContract,
      assetSymbol: obs.assetSymbol,
    });

    if (!linkedDepositId) linkedDepositId = deposit.id;
  }

  await prisma.webhookAuditLog.update({
    where: { id: auditLogId },
    data: {
      status: "PROCESSED",
      depositId: linkedDepositId,
      failureReason: null,
    },
  });
}
