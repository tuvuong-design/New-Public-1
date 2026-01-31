import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processPaymentWebhook, assertWebhookSecret } from "@/lib/payments/webhookProcessor";

export const runtime = "nodejs";

const schema = z.object({
  // Bạn có thể gửi từ watcher riêng của bạn
  txHash: z.string().min(8),
  toAddress: z.string().min(10),
  fromAddress: z.string().min(10).optional(),
  tokenContract: z.string().min(10).optional(),
  assetSymbol: z.string().min(2).optional(), // USDT/USDC
  amount: z.union([z.string(), z.number()]),
  memo: z.string().optional(), // (thường TRON không có memo)
});

function headersToObject(req: NextRequest) {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => { out[k] = v; });
  return out;
}

/**
 * TRON (TRC20) webhook:
 * - TronGrid thường không có webhook transfer miễn phí ổn định, nên endpoint này nhận payload chuẩn hoá từ watcher của bạn.
 * - Chỉ hỗ trợ USDT/USDC theo yêu cầu.
 */
export async function POST(req: NextRequest) {
  const sec = assertWebhookSecret(req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret"));
  if (!sec.ok) return NextResponse.json({ ok: false, error: sec.reason }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });

  // Adapter để reuse extractor ALCHEMY-like (activity list)
  const payload = {
    event: {
      activity: [
        {
          hash: parsed.data.txHash,
          toAddress: parsed.data.toAddress,
          fromAddress: parsed.data.fromAddress,
          asset: parsed.data.assetSymbol,
          rawContract: { address: parsed.data.tokenContract, value: parsed.data.amount },
        },
      ],
    },
  };

  const res = await processPaymentWebhook({
    provider: "TRONGRID",
    chain: "TRON",
    endpoint: "/api/webhooks/crypto/tron",
    ip: req.headers.get("x-forwarded-for") || null,
    headers: headersToObject(req),
    payload,
  });

  return NextResponse.json(res);
}
