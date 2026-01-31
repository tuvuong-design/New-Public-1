import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  strictMode: z.boolean(),
  providerAccuracyMode: z.boolean(),
  toleranceBps: z.coerce.number().int().min(0).max(5000),
  submittedStaleMinutes: z.coerce.number().int().min(1).max(10_000),
  reconcileEveryMs: z.coerce.number().int().min(30_000).max(24 * 60 * 60 * 1000),
  allowlistJson: z.string().min(2).max(20_000),

  // Growth / Monetization
  seasonPassEnabled: z.boolean().optional().default(false),
  seasonPassPriceStars: z.coerce.number().int().min(1).max(1_000_000).optional().default(300),

  referralEnabled: z.boolean().optional().default(false),
  referralPercent: z.coerce.number().int().min(1).max(20).optional().default(5),
  referralApplyToTopups: z.boolean().optional().default(true),
  referralApplyToEarnings: z.boolean().optional().default(true),
});

function safeJsonObject(s: string) {
  try {
    const obj = JSON.parse(s);
    if (!obj || typeof obj !== "object") return null;
    return obj;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const cfg = await prisma.paymentConfig.findUnique({ where: { id: 1 } });
  return Response.json({ config: cfg });
}

export async function POST(req: Request) {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY", details: parsed.error.flatten() }, { status: 400 });

  const allow = safeJsonObject(parsed.data.allowlistJson);
  if (!allow) return Response.json({ error: "INVALID_ALLOWLIST_JSON" }, { status: 400 });

  const cfg = await prisma.paymentConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      strictMode: parsed.data.strictMode,
      providerAccuracyMode: parsed.data.providerAccuracyMode,
      toleranceBps: parsed.data.toleranceBps,
      submittedStaleMinutes: parsed.data.submittedStaleMinutes,
      reconcileEveryMs: parsed.data.reconcileEveryMs,
      allowlistJson: parsed.data.allowlistJson,

      seasonPassEnabled: parsed.data.seasonPassEnabled,
      seasonPassPriceStars: parsed.data.seasonPassPriceStars,

      referralEnabled: parsed.data.referralEnabled,
      referralPercent: parsed.data.referralPercent,
      referralApplyToTopups: parsed.data.referralApplyToTopups,
      referralApplyToEarnings: parsed.data.referralApplyToEarnings,

      seasonPassEnabled: parsed.data.seasonPassEnabled,
      seasonPassPriceStars: parsed.data.seasonPassPriceStars,

      referralEnabled: parsed.data.referralEnabled,
      referralPercent: parsed.data.referralPercent,
      referralApplyToTopups: parsed.data.referralApplyToTopups,
      referralApplyToEarnings: parsed.data.referralApplyToEarnings,
    },
    update: {
      strictMode: parsed.data.strictMode,
      providerAccuracyMode: parsed.data.providerAccuracyMode,
      toleranceBps: parsed.data.toleranceBps,
      submittedStaleMinutes: parsed.data.submittedStaleMinutes,
      reconcileEveryMs: parsed.data.reconcileEveryMs,
      allowlistJson: parsed.data.allowlistJson,

      seasonPassEnabled: parsed.data.seasonPassEnabled,
      seasonPassPriceStars: parsed.data.seasonPassPriceStars,

      referralEnabled: parsed.data.referralEnabled,
      referralPercent: parsed.data.referralPercent,
      referralApplyToTopups: parsed.data.referralApplyToTopups,
      referralApplyToEarnings: parsed.data.referralApplyToEarnings,

      seasonPassEnabled: parsed.data.seasonPassEnabled,
      seasonPassPriceStars: parsed.data.seasonPassPriceStars,

      referralEnabled: parsed.data.referralEnabled,
      referralPercent: parsed.data.referralPercent,
      referralApplyToTopups: parsed.data.referralApplyToTopups,
      referralApplyToEarnings: parsed.data.referralApplyToEarnings,
    },
  });

  return Response.json({ ok: true, config: cfg });
}
