import { Queue } from "bullmq";
import { getRedis } from "./redis";

export const queues = {
  processVideo: new Queue("processVideo", { connection: getRedis() }),
  encodeHls: new Queue("encodeHls", { connection: getRedis() }),
  syncApiSource: new Queue("syncApiSource", { connection: getRedis() }),
  subtitles: new Queue("subtitles", { connection: getRedis() }),
  clamavScan: new Queue("clamavScan", { connection: getRedis() }),
  payments: new Queue("payments", { connection: getRedis() }),
  nft: new Queue("nft", { connection: getRedis() }),
  analytics: new Queue("analytics", { connection: getRedis() }),
  creatorWebhooks: new Queue("creatorWebhooks", { connection: getRedis() }),
  editor: new Queue("editor", { connection: getRedis() }),
  moderation: new Queue("moderation", { connection: getRedis() }),
  cdn: new Queue("cdn", { connection: getRedis() }),
};
