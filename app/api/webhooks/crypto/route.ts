import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processPaymentWebhook, assertWebhookSecret } from "@/lib/payments/webhookProcessor";

export const runtime = "nodejs";

const schema = z.object({
  provider: z.enum(["HELIUS","ALCHEMY","TRONGRID","QUICKNODE","MANUAL"]),
  chain: z.enum(["SOLANA","ETHEREUM","POLYGON","BSC","BASE","TRON"]),
  payload: z.any(),
});

function headersToObject(req: NextRequest) {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => { out[k] = v; });
  return out;
}

export async function POST(req: NextRequest) {
  const sec = assertWebhookSecret(req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret"));
  if (!sec.ok) return NextResponse.json({ ok: false, error: sec.reason }, { status: 401 });

  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: "invalid_body", details: body.error.flatten() }, { status: 400 });

  const res = await processPaymentWebhook({
    provider: body.data.provider,
    chain: body.data.chain,
    endpoint: "/api/webhooks/crypto",
    ip: req.headers.get("x-forwarded-for") || null,
    headers: headersToObject(req),
    payload: body.data.payload,
  });

  return NextResponse.json(res);
}
