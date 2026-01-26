import IORedis from "ioredis";
import { Queue } from "bullmq";
import { env } from "./env";

export const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Payments queue (stars topup webhooks + reconcile)
export const paymentsQueue = new Queue("payments", { connection });

// Analytics queue (watch time / retention / realtime / A/B)
export const analyticsQueue = new Queue("analytics", { connection });

// Notifications queue (in-app, digest)
export const notificationsQueue = new Queue("notifications", { connection });

// Storage queue (R2/FTP/Drive redundancy)
export const storageQueue = new Queue("storage", { connection });
