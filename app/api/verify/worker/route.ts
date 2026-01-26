import { isConfiguredEnv, requireEnv } from "@/lib/env";

export const runtime = "nodejs";

type Res =
  | { ok: true; message: string; latencyMs: number; result?: any }
  | { ok: false; message: string; latencyMs: number };

export async function GET() {
  if (!isConfiguredEnv()) {
    return Response.json({ ok: false, message: "Env chưa đủ để verify worker.", latencyMs: 0 } satisfies Res, { status: 400 });
  }

  const env = requireEnv();
  const t0 = Date.now();

  try {
    const IORedis = (await import("ioredis")).default;
    const { Queue, QueueEvents } = await import("bullmq");

    const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
    const queueName = "verify";
    const queue = new Queue(queueName, { connection });
    const events = new QueueEvents(queueName, { connection });

    try {
      const job = await queue.add("ping", { ts: Date.now() }, { removeOnComplete: true, removeOnFail: 100 });
      const result = await job.waitUntilFinished(events, 5000);
      const ms = Date.now() - t0;
      return Response.json({ ok: true, message: "Worker ping OK", latencyMs: ms, result } satisfies Res);
    } finally {
      await events.close().catch(() => {});
      await queue.close().catch(() => {});
      await connection.quit().catch(() => {});
    }
  } catch (e: any) {
    const ms = Date.now() - t0;
    return Response.json({ ok: false, message: e?.message || "Worker ping failed", latencyMs: ms } satisfies Res, { status: 400 });
  }
}
