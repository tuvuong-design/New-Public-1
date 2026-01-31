import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { Chain, PaymentProvider } from "@prisma/client";

export type ProviderAllowlist = Partial<Record<Chain, PaymentProvider[]>>;

export const DEFAULT_ALLOWLIST: ProviderAllowlist = {
  SOLANA: ["HELIUS", "QUICKNODE"],
  ETHEREUM: ["ALCHEMY", "QUICKNODE"],
  POLYGON: ["ALCHEMY", "QUICKNODE"],
  BSC: ["ALCHEMY", "QUICKNODE"],
  BASE: ["ALCHEMY", "QUICKNODE"],
  TRON: ["TRONGRID"],
};

export async function getOrInitPaymentConfig() {
  const existing = await prisma.paymentConfig.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.paymentConfig.create({
    data: {
      id: 1,
      strictMode: false,
      toleranceBps: env.PAYMENTS_TOLERANCE_BPS,
      submittedStaleMinutes: env.PAYMENTS_SUBMITTED_STALE_MINUTES,
      reconcileEveryMs: env.PAYMENTS_RECONCILE_EVERY_MS,
      allowlistJson: JSON.stringify(DEFAULT_ALLOWLIST),

      // Growth / Monetization defaults
      seasonPassEnabled: false,
      seasonPassPriceStars: 300,
      referralEnabled: false,
      referralPercent: 5,
      referralApplyToTopups: true,
      referralApplyToEarnings: true,
    },
  });
}

export function parseAllowlist(json: string | null | undefined): ProviderAllowlist {
  if (!json) return { ...DEFAULT_ALLOWLIST };
  try {
    const data = JSON.parse(json) as ProviderAllowlist;
    return data;
  } catch {
    return { ...DEFAULT_ALLOWLIST };
  }
}

export async function getProviderSecret(provider: PaymentProvider, name: string) {
  const envName = env.APP_ENV;
  const row = await prisma.paymentProviderSecret.findFirst({
    where: { env: envName, provider, name, active: true },
    orderBy: { updatedAt: "desc" },
  });
  if (row?.value) return row.value;

  // Fallback env vars (legacy/simple)
  if (provider === "ALCHEMY" && name === "webhookSigningKey") return env.ALCHEMY_WEBHOOK_SIGNING_KEY;
  if (provider === "QUICKNODE" && name === "webhookSecret") return env.QUICKNODE_WEBHOOK_SECRET;
  if (provider === "HELIUS" && name === "webhookSecret") return env.HELIUS_WEBHOOK_SECRET;

  return "";
}
