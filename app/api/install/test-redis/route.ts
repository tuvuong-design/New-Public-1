import { z } from "zod";
import { canAccessInstallWizard } from "@/lib/install/guard";

export const runtime = "nodejs";

const schema = z.object({ redisUrl: z.string().min(1) });

export async function POST(req: Request) {
  if (!canAccessInstallWizard()) return new Response("Not found", { status: 404 });
  const body = schema.parse(await req.json());

  try {
    const Redis = (await import("ioredis")).default;
    const r = new Redis(body.redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
    const pong = await r.ping();
    await r.quit();
    return Response.json({ ok: true, message: `Redis OK (${pong})` });
  } catch (e: any) {
    return Response.json({ ok: false, message: e?.message || "Redis connection failed" }, { status: 400 });
  }
}
