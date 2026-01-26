import { ingestWebhook } from "@/lib/payments/webhookIngest";
import { getRequestIp } from "@/lib/requestIp";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const ip = getRequestIp(req);
  const res = await ingestWebhook({
    provider: "TRONGRID",
    chain: "TRON",
    endpoint: "trongrid",
    ip,
    headers: req.headers,
    rawBody,
  });
  return Response.json({ ok: res.ok, auditLogId: (res as any).auditLogId }, { status: res.status });
}
