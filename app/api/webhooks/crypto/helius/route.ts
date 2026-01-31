import { NextRequest, NextResponse } from "next/server";
import { processPaymentWebhook, assertWebhookSecret } from "@/lib/payments/webhookProcessor";

export const runtime = "nodejs";

function headersToObject(req: NextRequest) {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => { out[k] = v; });
  return out;
}

/**
 * Helius Webhook (Solana) -> auto-credit stars:
 * - Bảo mật bằng header x-webhook-secret
 * - Payload có thể là mảng Enhanced Tx hoặc object chứa data
 * - Hệ thống sẽ parse tokenTransfers/nativeTransfers + memo
 */
export async function POST(req: NextRequest) {
  const sec = assertWebhookSecret(req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret"));
  if (!sec.ok) return NextResponse.json({ ok: false, error: sec.reason }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const res = await processPaymentWebhook({
    provider: "HELIUS",
    chain: "SOLANA",
    endpoint: "/api/webhooks/crypto/helius",
    ip: req.headers.get("x-forwarded-for") || null,
    headers: headersToObject(req),
    payload,
  });

  return NextResponse.json(res);
}
