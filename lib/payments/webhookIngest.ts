import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Chain, PaymentProvider } from "@prisma/client";
import { getOrInitPaymentConfig, parseAllowlist } from "@/lib/payments/config";
import { rateLimitRedis } from "@/lib/payments/rateLimit";
import { verifyWebhookSignature } from "@/lib/payments/providerVerify";
import { queues } from "@/lib/queues";

export async function ingestWebhook(params: {
  provider: PaymentProvider;
  chain: Chain | null;
  endpoint: string;
  ip: string | null;
  headers: Headers;
  rawBody: string;
}) {
  const { provider, chain, endpoint, ip, headers, rawBody } = params;
  const cfg = await getOrInitPaymentConfig();
  const allowlist = parseAllowlist(cfg.allowlistJson);

  // Rate limit: 120 req/min/provider/ip
  const rl = await rateLimitRedis(`wh:${provider}:${ip || "unknown"}`, 120, 60);
  if (!rl.ok) {
    return { ok: false as const, status: 429, message: "rate-limited" };
  }

  // Strict per chain/provider
  if (cfg.strictMode && chain) {
    const allowed = allowlist[chain] || [];
    if (!allowed.includes(provider)) {
      await prisma.webhookAuditLog.create({
        data: {
          provider,
          chain,
          endpoint,
          ip: ip || undefined,
          headersJson: safeJson(headersToObject(headers)),
          payloadJson: rawBody,
          sha256: sha256Hex(rawBody),
          status: "REJECTED",
          failureReason: `provider-not-allowed:${provider}`,
        },
      });
      return { ok: false as const, status: 403, message: "provider-not-allowed" };
    }
  }

  // Provider accuracy mode (signature)
  if (cfg.providerAccuracyMode) {
    const sig = await verifyWebhookSignature({ provider, rawBody, headers });
    if (!sig.ok) {
      await prisma.webhookAuditLog.create({
        data: {
          provider,
          chain,
          endpoint,
          ip: ip || undefined,
          headersJson: safeJson(headersToObject(headers)),
          payloadJson: rawBody,
          sha256: sha256Hex(rawBody),
          status: "REJECTED",
          failureReason: `bad-signature:${sig.reason || "unknown"}`,
        },
      });
      return { ok: false as const, status: 401, message: "bad-signature" };
    }
  }

  const row = await prisma.webhookAuditLog.create({
    data: {
      provider,
      chain,
      endpoint,
      ip: ip || undefined,
      headersJson: safeJson(headersToObject(headers)),
      payloadJson: rawBody,
      sha256: sha256Hex(rawBody),
      status: "RECEIVED",
    },
  });

  // Enqueue async processing (retry handled by worker)
  await queues.payments.add(
    "process_webhook_audit",
    { auditLogId: row.id },
    { removeOnComplete: true, removeOnFail: 100, attempts: 10, backoff: { type: "exponential", delay: 5000 } }
  );

  return { ok: true as const, status: 200, auditLogId: row.id };
}

function sha256Hex(data: string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function headersToObject(headers: Headers) {
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

function safeJson(obj: unknown) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "{}";
  }
}
