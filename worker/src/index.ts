import "dotenv/config";
import { Queue, Worker, QueueScheduler } from "bullmq";
import { connection, paymentsQueue, notificationsQueue } from "./queues";
import { processVideo } from "./jobs/processVideo";
import { encodeHls } from "./jobs/encodeHls";
import { syncApiSource } from "./jobs/syncApiSource";
import { applyPendingStorageConfigJob } from "./jobs/storage/applyPendingConfig";
import { storageHealthScanJob } from "./jobs/storage/healthScan";
import { backupOriginJob } from "./jobs/storage/backupOrigin";
import { rebuildHlsFromDriveJob } from "./jobs/storage/rebuildHlsFromDrive";
import { generateSubtitles } from "./jobs/subtitles";
import { prisma } from "./prisma";
import { flags } from "./env";

import { processWebhookAuditJob } from "./jobs/payments/processWebhookAudit";
import { reconcileDepositJob } from "./jobs/payments/reconcileDeposit";
import { reconcileStaleScanJob } from "./jobs/payments/reconcileStaleScan";
import { retryDeadLettersScanJob } from "./jobs/payments/retryDeadLettersScan";
import { paymentsAlertCronJob } from "./jobs/payments/alertCron";
import { watchChainDepositsJob } from "./jobs/payments/watchChainDeposits";
import { env } from "./env";

import { nftExportPrepareJob } from "./jobs/nft/exportPrepare";
import { nftExportVerifyTxJob } from "./jobs/nft/exportVerify";
import { nftGateSyncJob } from "./jobs/nft/nftGateSync";
import { clipMintNftJob } from "./jobs/nft/clipMintNft";
import { nftRetryDeadLettersScanJob } from "./jobs/nft/retryDeadLettersScan";
import { analyticsIngestEventsJob } from "./jobs/analytics/ingestEvents";
import { deliverPendingCreatorWebhooks } from "./jobs/creatorWebhooks/deliverPending";
import { purgePathsJob } from "./jobs/cdn/purgePaths";
import { moderationReviewJob } from "./jobs/moderation/review";
import { trimVideoJob } from "./jobs/editor/trimVideo";
import { createClipJob } from "./jobs/editor/createClip";
import { membershipBillingScanJob } from "./jobs/memberships/billingScan";
import { weeklyDigestJob } from "./jobs/notifications/weeklyDigest";
import { continueWatchingDigestJob } from "./jobs/notifications/continueWatchingDigest";

function log(...args: any[]) {
  console.log(new Date().toISOString(), ...args);
}

const qEncode = new Queue("encodeHls", { connection });
const qSubs = new Queue("subtitles", { connection });
const qStorage = new Queue("storage", { connection });
const qProcessVideo = new Queue("processVideo", { connection });
const qCreatorWebhooks = new Queue("creatorWebhooks", { connection });
const qEditor = new Queue("editor", { connection });
const qCdn = new Queue("cdn", { connection });
const qModeration = new Queue("moderation", { connection });
const qNotifications = new Queue("notifications", { connection });
const qNft = new Queue("nft", { connection });

// Scheduler for repeatable creator webhook deliveries
const schedulerCreatorWebhooks = new QueueScheduler("creatorWebhooks", { connection });
const schedulerEditor = new QueueScheduler("editor", { connection });
const schedulerCdn = new QueueScheduler("cdn", { connection });
const schedulerModeration = new QueueScheduler("moderation", { connection });
const schedulerNotifications = new QueueScheduler("notifications", { connection });

// Scheduler for repeatable/delayed jobs
const schedulerPayments = new QueueScheduler("payments", { connection });
const schedulerNft = new QueueScheduler("nft", { connection });
const schedulerStorage = new QueueScheduler("storage", { connection });

async function ensurePaymentsRepeatableJobs() {
  // Repeatable jobs are de-duplicated by (name + repeat opts). These are safe to call on every boot.
  await paymentsQueue.add(
    "reconcile_stale_scan",
    {},
    {
      repeat: { every: env.PAYMENTS_RECONCILE_EVERY_MS },
      jobId: "reconcile_stale_scan",
      removeOnComplete: true,
      removeOnFail: 1000,
    }
  );

  await paymentsQueue.add(
    "retry_dead_letters_scan",
    {},
    {
      repeat: { every: 2 * 60 * 1000 },
      jobId: "retry_dead_letters_scan",
      removeOnComplete: true,
      removeOnFail: 1000,
    }
  );

  await paymentsQueue.add(
    "alert_cron",
    {},
    {
      repeat: { every: 15 * 60 * 1000 },
      jobId: "alert_cron",
      removeOnComplete: true,
      removeOnFail: 1000,
    }
  );



await paymentsQueue.add(
  "watch_bsc_deposits",
  { chain: "BSC" },
  {
    repeat: { every: env.PAYMENTS_WATCH_BSC_EVERY_MS },
    jobId: "watch_bsc_deposits",
    removeOnComplete: true,
    removeOnFail: 1000,
  }
);

await paymentsQueue.add(
  "watch_tron_deposits",
  { chain: "TRON" },
  {
    repeat: { every: env.PAYMENTS_WATCH_TRON_EVERY_MS },
    jobId: "watch_tron_deposits",
    removeOnComplete: true,
    removeOnFail: 1000,
  }
await paymentsQueue.add(
  "watch_solana_deposits",
  { chain: "SOLANA" },
  {
    repeat: { every: env.PAYMENTS_WATCH_SOLANA_EVERY_MS },
    jobId: "watch_solana_deposits",
    removeOnComplete: true,
    removeOnFail: 1000,
  }
);

// EVM chains (optional): ETHEREUM / POLYGON / BASE
await paymentsQueue.add(
  "watch_ethereum_deposits",
  { chain: "ETHEREUM" },
  {
    repeat: { every: env.PAYMENTS_WATCH_EVM_EVERY_MS },
    jobId: "watch_ethereum_deposits",
    removeOnComplete: true,
    removeOnFail: 1000,
  }
);

await paymentsQueue.add(
  "watch_polygon_deposits",
  { chain: "POLYGON" },
  {
    repeat: { every: env.PAYMENTS_WATCH_EVM_EVERY_MS },
    jobId: "watch_polygon_deposits",
    removeOnComplete: true,
    removeOnFail: 1000,
  }
);

await paymentsQueue.add(
  "watch_base_deposits",
  { chain: "BASE" },
  {
    repeat: { every: env.PAYMENTS_WATCH_EVM_EVERY_MS },
    jobId: "watch_base_deposits",
    removeOnComplete: true,
    removeOnFail: 1000,
  }
);

  );

  await paymentsQueue.add(
    "membership_billing_scan",
    {},
    {
      repeat: { every: env.MEMBERSHIP_BILLING_EVERY_MS },
      jobId: "membership_billing_scan",
      removeOnComplete: true,
      removeOnFail: 1000,
    }
  );
}



async function ensureNftRepeatableJobs() {
  // Scan linked wallets and refresh snapshot holdings (used by NFT-gated features)
  await qNft.add(
    "nft_gate_sync",
    { reason: "repeatable_cron", addresses: [] },
    { jobId: "repeatable:nft_gate_sync", repeat: { every: 10 * 60 * 1000 }, removeOnComplete: true, removeOnFail: 1000 }
  );

  await qNft.add(
    "nft_retry_dead_letters_scan",
    {},
    { jobId: "repeatable:nft_retry_dead_letters_scan", repeat: { every: 5 * 60 * 1000 }, removeOnComplete: true, removeOnFail: 1000 }
  );
}


async function ensureNotificationsRepeatableJobs() {
  await notificationsQueue.add(
    "weekly_digest",
    {},
    {
      repeat: { every: env.NOTIFICATIONS_WEEKLY_DIGEST_EVERY_MS },
      jobId: "weekly_digest",
      removeOnComplete: true,
      removeOnFail: 1000,
    },
  );

  await notificationsQueue.add(
    "continue_watching_digest",
    {},
    {
      repeat: { every: env.NOTIFICATIONS_CONTINUE_WATCHING_DIGEST_EVERY_MS },
      jobId: "continue_watching_digest",
      removeOnComplete: true,
      removeOnFail: 1000,
    },
  );
}

async function ensureStorageRepeatableJobs() {
  // Apply pending Storage config after 24h delay
  await qStorage.add(
    "apply_pending_config",
    {},
    { repeat: { every: 60 * 1000 }, jobId: "apply_pending_config", removeOnComplete: true, removeOnFail: 1000 },
  );

  // Health scan for HLS fallback + auto rebuild from Drive
  await qStorage.add(
    "health_scan",
    {},
    { repeat: { every: 5 * 60 * 1000 }, jobId: "health_scan", removeOnComplete: true, removeOnFail: 1000 },
  );
}

async function ensureCreatorWebhookRepeatableJobs() {
  await qCreatorWebhooks.add(
    "deliver_pending",
    {},
    {
      repeat: { every: 60 * 1000 },
      jobId: "deliver_pending",
      removeOnComplete: true,
      removeOnFail: 1000,
    },
  );
}

const workerProcessVideo = new Worker(
  "processVideo",
  async (job) => {
    const { videoId } = job.data as { videoId: string };
    log("processVideo", videoId);
    await processVideo(videoId);
    // Backup MP4 origin to FTP/Drive (best-effort, async)
    await qStorage.add("backup_origin", { videoId }, { removeOnComplete: true, removeOnFail: 100 });
    await qEncode.add("encode", { videoId }, { removeOnComplete: true, removeOnFail: 100 });
    return { ok: true };
  },
  { connection, concurrency: 2 }
);

const workerEncodeHls = new Worker(
  "encodeHls",
  async (job) => {
    const { videoId } = job.data as { videoId: string };
    log("encodeHls", videoId);
    const out = await encodeHls(videoId);

    if (flags.subtitlesAuto) {
      await qSubs.add("subtitle", { videoId, lang: "vi" }, { removeOnComplete: true, removeOnFail: 100 });
    }

    return out;
  },
  { connection, concurrency: 1 }
);

const workerSyncApi = new Worker(
  "syncApiSource",
  async (job) => {
    const { apiSourceId } = job.data as { apiSourceId: string };
    log("syncApiSource", apiSourceId);
    return syncApiSource(apiSourceId);
  },
  { connection, concurrency: 1 }
);

const workerSubtitles = new Worker(
  "subtitles",
  async (job) => {
    const { videoId, lang } = job.data as { videoId: string; lang: string };
    log("subtitles", videoId, lang);
    return generateSubtitles(videoId, lang);
  },
  { connection, concurrency: 1 }
);

const workerStorage = new Worker(
  "storage",
  async (job) => {
    switch (job.name) {
      case "apply_pending_config": {
        log("storage.apply_pending_config");
        return applyPendingStorageConfigJob();
      }
      case "health_scan": {
        log("storage.health_scan");
        return storageHealthScanJob();
      }
      case "backup_origin": {
        const { videoId } = job.data as { videoId: string };
        log("storage.backup_origin", videoId);
        return backupOriginJob({ videoId });
      }
      case "rebuild_hls_from_drive": {
        const { videoId } = job.data as { videoId: string };
        log("storage.rebuild_hls_from_drive", videoId);
        return rebuildHlsFromDriveJob({ videoId });
      }
      default:
        throw new Error(`Unknown storage job: ${job.name}`);
    }
  },
  { connection, concurrency: 1 },
);

const workerPayments = new Worker(
  "payments",
  async (job) => {
    switch (job.name) {
      case "process_webhook_audit":
      case "processWebhookAudit": {
        const { auditLogId } = job.data as { auditLogId: string };
        log("payments.process_webhook_audit", auditLogId);
        await processWebhookAuditJob(auditLogId);
        return { ok: true };
      }
      case "reconcile_deposit":
      case "reconcileDeposit": {
        const { depositId } = job.data as { depositId: string };
        log("payments.reconcile_deposit", depositId);
        await reconcileDepositJob(depositId);
        return { ok: true };
      }
      case "reconcile_stale_scan": {
        log("payments.reconcile_stale_scan");
        return reconcileStaleScanJob();
      }
      case "watch_bsc_deposits": {
        log("payments.watch_bsc_deposits");
        await watchChainDepositsJob({ chain: "BSC" });
        return { ok: true };
      }
      case "watch_tron_deposits": {
        log("payments.watch_tron_deposits");
        await watchChainDepositsJob({ chain: "TRON" });
        return { ok: true };
      }

case "watch_solana_deposits": {
  log("payments.watch_solana_deposits");
  await watchChainDepositsJob({ chain: "SOLANA" });
  return { ok: true };
}
case "watch_ethereum_deposits": {
  log("payments.watch_ethereum_deposits");
  await watchChainDepositsJob({ chain: "ETHEREUM" });
  return { ok: true };
}
case "watch_polygon_deposits": {
  log("payments.watch_polygon_deposits");
  await watchChainDepositsJob({ chain: "POLYGON" });
  return { ok: true };
}
case "watch_base_deposits": {
  log("payments.watch_base_deposits");
  await watchChainDepositsJob({ chain: "BASE" });
  return { ok: true };
}
      case "retry_dead_letters_scan": {
        log("payments.retry_dead_letters_scan");
        return retryDeadLettersScanJob();
      }
      case "alert_cron": {
        log("payments.alert_cron");
        return paymentsAlertCronJob();
      }
      case "membership_billing_scan": {
        log("payments.membership_billing_scan");
        return membershipBillingScanJob({ renewAheadHours: env.MEMBERSHIP_RENEW_AHEAD_HOURS });
      }
      default:
        return { ok: true };
    }
  },
  { connection, concurrency: 5 },
);

const workerNft = new Worker(
  "nft",
  async (job) => {
    switch (job.name) {
      case "nft_export_prepare": {
        const { exportRequestId } = job.data as { exportRequestId: string };
        log("nft.nft_export_prepare", exportRequestId);
        return nftExportPrepareJob(exportRequestId);
      }
      case "nft_export_verify_tx": {
        const { exportRequestId } = job.data as { exportRequestId: string };
        log("nft.nft_export_verify_tx", exportRequestId);
        return nftExportVerifyTxJob(exportRequestId);
      }
      case "nft_gate_sync": {
        log("nft.nft_gate_sync", job.id);
        return nftGateSyncJob(job.data as any);
      }
      case "clip_mint_nft": {
        const { clipId } = job.data as { clipId: string };
        log("nft.clip_mint_nft", clipId);
        return clipMintNftJob({ clipId });
      }
      case "nft_retry_dead_letters_scan": {
        log("nft.nft_retry_dead_letters_scan");
        return nftRetryDeadLettersScanJob();
      }
      default:
        return { ok: true };
    }
  },
  { connection, concurrency: 2 },
);

const workerAnalytics = new Worker(
  "analytics",
  async (job) => {
    switch (job.name) {
      case "analytics_ingest_events": {
        log("analytics.ingest", job.id);
        return analyticsIngestEventsJob(job.data as any);
      }
      default:
        return { ok: true };
    }
  },
  { connection, concurrency: 10 },
);

const workerCreatorWebhooks = new Worker(
  "creatorWebhooks",
  async (job) => {
    switch (job.name) {
      case "deliver_pending": {
        log("creatorWebhooks.deliver_pending");
        return deliverPendingCreatorWebhooks();
      }
      default:
        return { ok: true };
    }
  },
  { connection, concurrency: 2 },
);

const workerCdn = new Worker(
  "cdn",
  async (job) => {
    switch (job.name) {
      case "purge_paths": {
        return purgePathsJob(job.data as any);
      }
      default:
        return { ok: true };
    }
  },
  { connection, concurrency: 2 },
);

const workerModeration = new Worker(
  "moderation",
  async (job) => {
    switch (job.name) {
      case "review_report": {
        return moderationReviewJob(job.data as any);
      }
      default:
        return { ok: true };
    }
  },
  { connection, concurrency: 2 },
);

const workerEditor = new Worker(
  "editor",
  async (job) => {
    switch (job.name) {
      case "trim_video": {
        const { videoId, startSec, endSec } = job.data as { videoId: string; startSec: number; endSec: number };
        log("editor.trim_video", videoId, startSec, endSec);
        const out = await trimVideoJob({ videoId, startSec, endSec });
        // Re-run existing pipeline for thumbnails/HLS.
        await qProcessVideo.add("process", { videoId }, { removeOnComplete: true, removeOnFail: 100 });
        return out;
      }
      case "create_clip": {
        const { clipId } = job.data as { clipId: string };
        log("editor.create_clip", clipId);
        return createClipJob({ clipId });
      }
      default:
        return { ok: true };
    }
  },
  { connection, concurrency: 1 },
);


const workerNotifications = new Worker(
  "notifications",
  async (job) => {
    switch (job.name) {
      case "weekly_digest":
        return weeklyDigestJob();
      case "continue_watching_digest":
        return continueWatchingDigestJob();
      default:
        return { ok: true };
    }
  },
  { connection, concurrency: 1 },
);


const workerVerify = new Worker(
  "verify",
  async (job) => {
    if (job.name !== "ping") return { ok: true };
    return { pong: true, ts: Date.now() };
  },
  { connection, concurrency: 1 }
);

for (const w of [workerProcessVideo, workerEncodeHls, workerSyncApi, workerSubtitles, workerStorage, workerPayments, workerNft, workerAnalytics, workerCreatorWebhooks, workerCdn, workerModeration, workerEditor, workerNotifications, workerVerify]) {
  w.on("failed", (job, err) => log("FAILED", w.name, job?.id, err?.message));
  w.on("completed", (job) => log("COMPLETED", w.name, job.id));
}

ensurePaymentsRepeatableJobs().catch((e) => log("ensurePaymentsRepeatableJobs error", e?.message || e));
ensureNftRepeatableJobs().catch((e) => log("ensureNftRepeatableJobs error", e?.message || e));
ensureCreatorWebhookRepeatableJobs().catch((e) => log("ensureCreatorWebhookRepeatableJobs error", e?.message || e));
ensureNotificationsRepeatableJobs().catch((e) => log("ensureNotificationsRepeatableJobs error", e?.message || e));
ensureStorageRepeatableJobs().catch((e) => log("ensureStorageRepeatableJobs error", e?.message || e));

process.on("SIGINT", async () => {
  log("SIGINT closing...");
  await Promise.all([
    workerProcessVideo.close(),
    workerEncodeHls.close(),
    workerSyncApi.close(),
    workerSubtitles.close(),
    workerStorage.close(),
    workerPayments.close(),
    workerNft.close(),
    workerAnalytics.close(),
      workerCreatorWebhooks.close(),
      workerCdn.close(),
      workerModeration.close(),
      workerEditor.close(),
      workerNotifications.close(),
    workerVerify.close(),
  ]);
  await Promise.all([
    qEncode.close(),
    qSubs.close(),
    qStorage.close(),
    paymentsQueue.close(),
    qNft.close(),
    qCreatorWebhooks.close(),
    qCdn.close(),
    qModeration.close(),
    qEditor.close(),
    qNotifications.close(),
    schedulerPayments.close(),
    schedulerNft.close(),
    schedulerStorage.close(),
    schedulerCreatorWebhooks.close(),
    schedulerEditor.close(),
    schedulerNotifications.close(),
  ]);
  await prisma.$disconnect();
  process.exit(0);
});