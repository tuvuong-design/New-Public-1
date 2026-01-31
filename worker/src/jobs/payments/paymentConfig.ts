import type { Chain, PaymentProvider } from "@prisma/client";
import { prisma } from "../../prisma";
import { env } from "../../env";

export type ProviderAllowlist = Partial<Record<Chain, PaymentProvider[]>>;

const DEFAULT_ALLOWLIST: ProviderAllowlist = {
  SOLANA: ["HELIUS", "QUICKNODE"],
  ETHEREUM: ["ALCHEMY", "QUICKNODE"],
  POLYGON: ["ALCHEMY", "QUICKNODE"],
  BSC: ["ALCHEMY", "QUICKNODE"],
  BASE: ["ALCHEMY", "QUICKNODE"],
  TRON: ["TRONGRID"],
};

export type PaymentConfigLike = {
  // Payments core

  strictMode: boolean;
  providerAccuracyMode: boolean;
  toleranceBps: number;
  submittedStaleMinutes: number;
  reconcileEveryMs: number;
  allowlist: ProviderAllowlist;

  // Growth / Monetization
  referralEnabled: boolean;
  referralPercent: number;
  referralApplyToTopups: boolean;
  referralApplyToEarnings: boolean;
};

let cache: { at: number; cfg: PaymentConfigLike } | null = null;

function parseAllowlist(json: string | null | undefined): ProviderAllowlist {
  if (!json) return { ...DEFAULT_ALLOWLIST };
  try {
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object") return { ...DEFAULT_ALLOWLIST };
    return obj as ProviderAllowlist;
  } catch {
    return { ...DEFAULT_ALLOWLIST };
  }
}

export async function getPaymentConfigCached(): Promise<PaymentConfigLike> {
  const now = Date.now();
  if (cache && now - cache.at < 30_000) return cache.cfg;

  const row = await prisma.paymentConfig.findUnique({ where: { id: 1 } });
  const cfg: PaymentConfigLike = {
    strictMode: row?.strictMode ?? false,
    providerAccuracyMode: row?.providerAccuracyMode ?? false,
    toleranceBps: row?.toleranceBps ?? env.PAYMENTS_TOLERANCE_BPS,
    submittedStaleMinutes: row?.submittedStaleMinutes ?? env.PAYMENTS_SUBMITTED_STALE_MINUTES,
    reconcileEveryMs: row?.reconcileEveryMs ?? env.PAYMENTS_RECONCILE_EVERY_MS,
    allowlist: parseAllowlist(row?.allowlistJson ?? undefined),

    referralEnabled: row?.referralEnabled ?? false,
    referralPercent: Math.max(0, Math.min(20, row?.referralPercent ?? 0)),
    referralApplyToTopups: row?.referralApplyToTopups ?? true,
    referralApplyToEarnings: row?.referralApplyToEarnings ?? true,
  };

  cache = { at: now, cfg };
  return cfg;
}

export async function getProviderSecret(provider: PaymentProvider, name: string) {
  const envName = env.APP_ENV;
  const row = await prisma.paymentProviderSecret.findFirst({
    where: { env: envName, provider, name, active: true },
    orderBy: { updatedAt: "desc" },
  });
  if (row?.value) return row.value;

  // Fallback env vars (legacy)
  if (provider === "ALCHEMY" && name === "webhookSigningKey") return env.ALCHEMY_WEBHOOK_SIGNING_KEY;
  if (provider === "QUICKNODE" && name === "webhookSecret") return env.QUICKNODE_WEBHOOK_SECRET;
  if (provider === "HELIUS" && name === "webhookSecret") return env.HELIUS_WEBHOOK_SECRET;

  return "";
}
