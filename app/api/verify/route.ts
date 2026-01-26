import { requireEnv, isConfiguredEnv } from "@/lib/env";

export const runtime = "nodejs";

type Check = { ok: boolean; message: string; latencyMs: number };

async function timeIt<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t0 };
}

async function checkDb(): Promise<Check> {
  try {
    const env = requireEnv();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
    try {
      const t = await timeIt(async () => prisma.$queryRawUnsafe("SELECT 1"));
      return { ok: true, message: "DB OK", latencyMs: t.ms };
    } finally {
      await prisma.$disconnect();
    }
  } catch (e: any) {
    return { ok: false, message: e?.message || "DB FAIL", latencyMs: 0 };
  }
}

async function checkRedis(): Promise<Check> {
  try {
    const env = requireEnv();
    const Redis = (await import("ioredis")).default;
    const r = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
    const t = await timeIt(async () => r.ping());
    await r.quit();
    return { ok: true, message: `Redis OK (${String(t.result)})`, latencyMs: t.ms };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Redis FAIL", latencyMs: 0 };
  }
}

async function checkR2(): Promise<Check> {
  try {
    const env = requireEnv();
    const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const r2 = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    });

    const t = await timeIt(async () => r2.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET, MaxKeys: 1 })));
    // Avoid returning raw list; only status
    const keys = (t.result.Contents ?? []).length;
    return { ok: true, message: `R2 OK (bucket reachable, sample=${keys})`, latencyMs: t.ms };
  } catch (e: any) {
    return { ok: false, message: e?.message || "R2 FAIL", latencyMs: 0 };
  }
}

export async function GET() {
  if (!isConfiguredEnv()) {
    return Response.json(
      {
        ok: false,
        configured: false,
        message: "Env chưa đủ. Hãy hoàn tất Install Wizard, paste .env vào aaPanel và restart rồi verify lại.",
      },
      { status: 400 }
    );
  }

  const [db, redis, r2] = await Promise.all([checkDb(), checkRedis(), checkR2()]);
  const ok = db.ok && redis.ok && r2.ok;

  return Response.json({
    ok,
    configured: true,
    checks: { db, redis, r2 },
    tip: ok ? "OK. Hãy chạy worker riêng (ffmpeg) để encode HLS." : "Có lỗi. Xem message từng check.",
  });
}
