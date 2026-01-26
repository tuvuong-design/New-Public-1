import { ingestWebhook } from "@/lib/payments/webhookIngest";
import { getRequestIp } from "@/lib/requestIp";
import { extractCandidateAddresses } from "@/lib/webhooks/extractAddresses";
import { queues } from "@/lib/queues";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const ip = getRequestIp(req);
  const res = await ingestWebhook({
    provider: "HELIUS",
    chain: "SOLANA",
    endpoint: "helius",
    ip,
    headers: req.headers,
    rawBody,
  });

// NFT-gate fast sync (best-effort; does not affect payments ingest)
try {
  const payload = JSON.parse(rawBody);
  const cand = extractCandidateAddresses(payload);
  const useChain = "SOLANA";
  
  const addrs = (useChain === "SOLANA" ? cand.solana : cand.evm).map((address) => ({ chain: useChain, address }));
  if (addrs.length) {
    await queues.nft.add("nft_gate_sync", { reason: "webhook_transfer", addresses: addrs }, { removeOnComplete: true, removeOnFail: 1000 });
  }
} catch {
  // ignore
}

  return Response.json({ ok: res.ok, auditLogId: (res as any).auditLogId }, { status: res.status });
}
