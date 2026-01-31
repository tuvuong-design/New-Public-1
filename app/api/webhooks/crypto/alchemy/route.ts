import { NextRequest, NextResponse } from "next/server";
import { processPaymentWebhook, assertWebhookSecret } from "@/lib/payments/webhookProcessor";

export const runtime = "nodejs";

function headersToObject(req: NextRequest) {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => { out[k] = v; });
  return out;
}

function inferChainFromAlchemy(payload: any): "BSC" | "ETHEREUM" | "POLYGON" | "BASE" {
  const net = (payload?.event?.network || payload?.network || "").toString().toUpperCase();
  if (net.includes("BSC") || net.includes("BNB")) return "BSC";
  if (net.includes("POLYGON") || net.includes("MATIC")) return "POLYGON";
  if (net.includes("BASE")) return "BASE";
  return "ETHEREUM";
}

/**
 * Alchemy Address Activity Webhook:
 * - Tracks ERC20 transfers (USDT/USDC) to custodial addresses
 * - Auto-credit stars when matched
 */
export async function POST(req: NextRequest) {
  const sec = assertWebhookSecret(req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret"));
  if (!sec.ok) return NextResponse.json({ ok: false, error: sec.reason }, { status: 401 });

  const payload = await req.json().catch(() => null);

  const url = new URL(req.url);
  const chainQ = (url.searchParams.get("chain") || "").toUpperCase();
  const chain = (chainQ === "BSC" || chainQ === "ETHEREUM" || chainQ === "POLYGON" || chainQ === "BASE")
    ? (chainQ as any)
    : inferChainFromAlchemy(payload);

  const res = await processPaymentWebhook({
    provider: "ALCHEMY",
    chain,
    endpoint: "/api/webhooks/crypto/alchemy",
    ip: req.headers.get("x-forwarded-for") || null,
    headers: headersToObject(req),
    payload,
  });

  return NextResponse.json(res);
}
