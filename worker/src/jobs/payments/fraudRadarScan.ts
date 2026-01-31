import { prisma } from "../../prisma";

export type FraudScanResult = {
  ok: boolean;
  created?: number;
  reasons?: string[];
  error?: string;
};

function floorWindow(now: number, windowMs: number) {
  return Math.floor(now / windowMs) * windowMs;
}

async function ensureAlert(params: {
  kind: any;
  severity: any;
  dedupeKey: string;
  title: string;
  message?: string;
  payload?: any;
}) {
  const payloadJson = params.payload != null ? JSON.stringify(params.payload) : undefined;
  await prisma.fraudAlert
    .upsert({
      where: { kind_dedupeKey: { kind: params.kind, dedupeKey: params.dedupeKey } },
      create: {
        kind: params.kind,
        severity: params.severity,
        dedupeKey: params.dedupeKey,
        title: params.title,
        message: params.message,
        payloadJson,
      },
      update: {
        // best-effort enrich only
        severity: params.severity,
        title: params.title,
        message: params.message,
        payloadJson,
      },
    })
    .catch(() => {});
}

/**
 * Fraud radar scan:
 * - Duplicate txHash across deposits (last 24h)
 * - Webhook fail-rate spike window (15m)
 * - NEEDS_REVIEW deposit burst window (15m)
 *
 * Designed to be called from payments.alert_cron (repeatable).
 */
export async function fraudRadarScanJob() {
  const now = Date.now();
  const reasons: string[] = [];
  let created = 0;

  try {
    // (1) Duplicate txHash across deposits (last 24h)
    const from24h = new Date(now - 24 * 60 * 60 * 1000);
    const grouped = await prisma.starDeposit.groupBy({
      by: ["txHash"],
      where: { createdAt: { gte: from24h }, txHash: { not: null } },
      _count: { _all: true },
      having: { txHash: { not: null } } as any,
    }).catch(() => [] as any[]);

    for (const g of grouped) {
      const txHash = String(g.txHash || "").trim();
      const cnt = Number(g._count?._all || 0);
      if (!txHash || cnt <= 1) continue;

      const deps = await prisma.starDeposit.findMany({
        where: { txHash },
        select: { id: true, userId: true, status: true, chain: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      await ensureAlert({
        kind: "DUP_TX_HASH",
        severity: "CRITICAL",
        dedupeKey: txHash,
        title: "Duplicate txHash seen across deposits",
        message: `txHash=${txHash} appears in ${cnt} deposits (last 24h)`,
        payload: { txHash, count: cnt, deposits: deps },
      });
      created += 1;
      reasons.push("DUP_TX_HASH");
    }

    // (2) Webhook fail-rate spike (15m)
    const windowMs = 15 * 60 * 1000;
    const from = new Date(now - windowMs);
    const minEvents = Number(process.env.PAYMENTS_ALERT_MIN_EVENTS || 20);
    const threshold = Number(process.env.PAYMENTS_ALERT_FAIL_RATE || 0.15);

    const [total, failed] = await Promise.all([
      prisma.webhookAuditLog.count({ where: { createdAt: { gte: from } } }),
      prisma.webhookAuditLog.count({ where: { createdAt: { gte: from }, status: { in: ["FAILED", "REJECTED"] } } }),
    ]);

    if (total >= minEvents) {
      const rate = total ? failed / total : 0;
      if (rate >= threshold) {
        const bucket = floorWindow(now, windowMs);
        await ensureAlert({
          kind: "WEBHOOK_FAIL_SPIKE",
          severity: "HIGH",
          dedupeKey: `bucket:${bucket}`,
          title: "Webhook fail-rate spike",
          message: `Window 15m: failRate=${(rate * 100).toFixed(1)}% total=${total} failed=${failed}`,
          payload: { windowMs, bucket, total, failed, rate },
        });
        created += 1;
        reasons.push("WEBHOOK_FAIL_SPIKE");
      }
    }

    // (3) NEEDS_REVIEW burst (15m)
    const needsReviewMin = Number(process.env.PAYMENTS_ALERT_NEEDS_REVIEW_MIN || 5);
    const nr = await prisma.starDeposit.count({ where: { createdAt: { gte: from }, status: "NEEDS_REVIEW" } });
    if (nr >= needsReviewMin) {
      const bucket = floorWindow(now, windowMs);
      await ensureAlert({
        kind: "NEEDS_REVIEW_BURST",
        severity: "MEDIUM",
        dedupeKey: `bucket:${bucket}`,
        title: "NEEDS_REVIEW deposit burst",
        message: `Window 15m: needsReview=${nr} (min=${needsReviewMin})`,
        payload: { windowMs, bucket, needsReview: nr, min: needsReviewMin },
      });
      created += 1;
      reasons.push("NEEDS_REVIEW_BURST");
    }

    return { ok: true, created, reasons } as FraudScanResult;
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e), created, reasons } as FraudScanResult;
  }
}
