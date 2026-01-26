import crypto from "node:crypto";
import { prisma } from "../../prisma";
import { env } from "../../env";

function allowlist() {
  const csv = String(env.CREATOR_WEBHOOK_ALLOWLIST || "").trim();
  return new Set(csv ? csv.split(",").map((s) => s.trim()).filter(Boolean) : []);
}

function isPrivateHostname(host: string) {
  const h = host.toLowerCase();
  if (h === "localhost") return true;
  // naive private ranges (covers common cases)
  if (/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(h)) return true;
  return false;
}

function urlOk(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, reason: "URL_INVALID" as const }; }
  if (u.protocol !== "https:") return { ok: false, reason: "URL_MUST_BE_HTTPS" as const };
  if (isPrivateHostname(u.hostname)) return { ok: false, reason: "URL_PRIVATE_HOST" as const };
  const list = allowlist();
  if (list.size > 0 && !list.has(u.hostname)) return { ok: false, reason: "URL_NOT_ALLOWLISTED" as const };
  return { ok: true, url: u };
}

function hmac(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function backoffMs(attempt: number) {
  const a = Math.max(0, Math.min(10, attempt));
  return Math.min(60 * 60 * 1000, 30_000 * Math.pow(2, a));
}

export async function deliverPendingCreatorWebhooks() {
  const now = new Date();
  const batch = await prisma.creatorWebhookDelivery.findMany({
    where: {
      status: "PENDING",
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { endpoint: true },
  });

  let sent = 0;
  let failed = 0;

  for (const d of batch) {
    const endpoint = d.endpoint;
    if (!endpoint?.enabled) {
      await prisma.creatorWebhookDelivery.update({ where: { id: d.id }, data: { status: "FAILED", lastError: "ENDPOINT_DISABLED" } });
      failed++;
      continue;
    }

    const u = urlOk(endpoint.url);
    if (!u.ok) {
      await prisma.creatorWebhookDelivery.update({ where: { id: d.id }, data: { status: "FAILED", lastError: u.reason } });
      failed++;
      continue;
    }

    const body = String(d.payloadJson || "{}");
    const ts = Math.floor(Date.now() / 1000);
    const sig = hmac(endpoint.secret, body);

    try {
      const res = await fetch(u.url.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "videoshare-worker/creator-webhooks",
          "x-videoshare-event": d.eventType,
          "x-videoshare-delivery": d.id,
          "x-videoshare-timestamp": String(ts),
          "x-videoshare-signature": sig,
        },
        body,
      });

      if (res.ok) {
        await prisma.creatorWebhookDelivery.update({ where: { id: d.id }, data: { status: "SENT", lastError: null, nextAttemptAt: null } });
        sent++;
        continue;
      }

      const errText = (await res.text()).slice(0, 1000);
      const nextAttempt = new Date(Date.now() + backoffMs(d.attempt));
      const nextAttemptCount = d.attempt + 1;
      await prisma.creatorWebhookDelivery.update({
        where: { id: d.id },
        data: {
          status: nextAttemptCount >= 6 ? "FAILED" : "PENDING",
          attempt: nextAttemptCount,
          lastError: `HTTP_${res.status}: ${errText}`,
          nextAttemptAt: nextAttemptCount >= 6 ? null : nextAttempt,
        },
      });
      failed++;
    } catch (e: any) {
      const nextAttemptCount = d.attempt + 1;
      const nextAttempt = new Date(Date.now() + backoffMs(d.attempt));
      await prisma.creatorWebhookDelivery.update({
        where: { id: d.id },
        data: {
          status: nextAttemptCount >= 6 ? "FAILED" : "PENDING",
          attempt: nextAttemptCount,
          lastError: String(e?.message || e).slice(0, 1000),
          nextAttemptAt: nextAttemptCount >= 6 ? null : nextAttempt,
        },
      });
      failed++;
    }
  }

  return { ok: true, scanned: batch.length, sent, failed };
}
