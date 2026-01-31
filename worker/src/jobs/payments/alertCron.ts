import { prisma } from "../../prisma";
import { env } from "../../env";
import { moderationEscalationScanJob } from "../moderation/escalationScan";
import { fraudRadarScanJob } from "./fraudRadarScan";
import { sendTelegramWorker, fmtDepositAlertTitle } from "../../lib/notify/telegram";

type Bucket = { total: number; failed: number };

async function postDiscord(message: string) {
  if (!env.DISCORD_ALERT_WEBHOOK_URL) return;
  await fetch(env.DISCORD_ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: message }),
  }).catch(() => {});
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function msToMin(ms: number) {
  return Math.round(ms / 60000);
}

async function watcherDeadmanScan() {
  const staleMinutes = env.PAYMENTS_WATCHER_STALE_MINUTES;
  const now = Date.now();
  const rows = await prisma.chainWatcherCursor.findMany({
    where: { key: "lastRun" },
    select: { chain: true, updatedAt: true, value: true },
  }).catch(() => []);
  const lastRunByChain = new Map<string, number>();
  for (const r of rows as any[]) {
    lastRunByChain.set(r.chain, new Date(r.updatedAt).getTime());
  }

  const chains: string[] = ["SOLANA", "TRON", "BSC", "ETHEREUM", "POLYGON", "BASE"];
  for (const c of chains) {
    const t = lastRunByChain.get(c) ?? 0;
    const ageMin = msToMin(now - t);
    if (!t || ageMin > staleMinutes) {
      await sendTelegramWorker(
        `${fmtDepositAlertTitle("⚠️ Watcher chậm / có thể bị dừng")}\nChain: ${c}\nLastRun: ${t ? new Date(t).toISOString() : "never"}\nAge(min): ${ageMin}\nThreshold(min): ${staleMinutes}`
      ).catch(() => null);
    }
  }
}

export async function paymentsAlertCronJob() {
  // Also run Trust & Safety escalation scan here (repeatable is already scheduled as `payments:alert_cron`).
  // Best-effort: never block payments alerts.
  const moderation = await moderationEscalationScanJob().catch((e) => ({ ok: false, error: String(e?.message ?? e) } as any));
  const fraud = await fraudRadarScanJob().catch((e) => ({ ok: false, error: String(e?.message ?? e) } as any));

  const windowMs = 15 * 60 * 1000;
  const now = Date.now();
  const from = new Date(now - windowMs);
  const prevFrom = new Date(now - windowMs * 2);
  const prevTo = new Date(now - windowMs);

  const threshold = Number(process.env.PAYMENTS_ALERT_FAIL_RATE || 0.15);
  const minEvents = Number(process.env.PAYMENTS_ALERT_MIN_EVENTS || 20);
  const spikeMultiplier = Number(process.env.PAYMENTS_ALERT_SPIKE_MULTIPLIER || 2);

  const needsReviewMin = Number(process.env.PAYMENTS_ALERT_NEEDS_REVIEW_MIN || 5);

  const [cur, prev] = await Promise.all([
    prisma.webhookAuditLog.groupBy({
      by: ["chain"],
      where: { createdAt: { gte: from } },
      _count: { _all: true },
      _sum: { failedInt: true as any },
    }).catch(async () => {
      // Prisma doesn't support boolean sums; fallback with two queries.
      return [] as any[];
    }),
    prisma.webhookAuditLog.groupBy({
      by: ["chain"],
      where: { createdAt: { gte: prevFrom, lt: prevTo } },
      _count: { _all: true },
      _sum: { failedInt: true as any },
    }).catch(async () => {
      return [] as any[];
    }),
  ]);

  // Fallback without boolean sum: do manual counts
  const curTotal = await prisma.webhookAuditLog.count({ where: { createdAt: { gte: from } } });
  const curFailed = await prisma.webhookAuditLog.count({ where: { createdAt: { gte: from }, status: { in: ["FAILED", "REJECTED"] } } });
  const prevTotal = await prisma.webhookAuditLog.count({ where: { createdAt: { gte: prevFrom, lt: prevTo } } });
  const prevFailed = await prisma.webhookAuditLog.count({ where: { createdAt: { gte: prevFrom, lt: prevTo }, status: { in: ["FAILED", "REJECTED"] } } });

  if (curTotal < minEvents) return { curTotal, curFailed, skipped: true, moderation, fraud };

  const curRate = curTotal ? curFailed / curTotal : 0;
  const prevRate = prevTotal ? prevFailed / prevTotal : 0;

  if (curRate >= threshold && (prevRate === 0 ? curRate >= threshold : curRate >= prevRate * spikeMultiplier)) {
    const chainBreak = await prisma.webhookAuditLog.groupBy({
      by: ["chain"],
      where: { createdAt: { gte: from } },
      _count: { _all: true },
    });

    const lines = chainBreak
      .map((b) => `- ${b.chain}: ${b._count._all}`)
      .join("\n");

    await postDiscord(
      `⚠️ *Payments webhook fail-rate spike*\nWindow: last 15m\nFail rate: ${fmtPct(curRate)} (prev ${fmtPct(prevRate)})\nTotal: ${curTotal}, Failed: ${curFailed}\n\nBy chain:\n${lines}`,
    );

    return { alerted: true, curTotal, curFailed, curRate, prevRate, moderation, fraud };
  }

  // Also alert on a burst of NEEDS_REVIEW deposits (often risk-rule triggers or provider issues)
  const needsReview = await prisma.starDeposit.count({ where: { createdAt: { gte: from }, status: "NEEDS_REVIEW" } });
  if (needsReview >= needsReviewMin) {
      await watcherDeadmanScan().catch(() => null);

  await postDiscord(`⚠️ *Payments deposits NEEDS_REVIEW burst*\nWindow: last 15m\nNEEDS_REVIEW: ${needsReview}`);
    return { alerted: true, reason: "NEEDS_REVIEW_BURST", needsReview, moderation, fraud };
  }

  return { alerted: false, curTotal, curFailed, curRate, prevRate, moderation, fraud };
}
