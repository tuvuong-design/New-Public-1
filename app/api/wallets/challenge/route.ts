import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getRedis } from "@/lib/redis";
import { makeWalletLinkMessage, normalizeAddress, normalizeChain, randomNonce } from "@/lib/walletLink";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  chain: z.string().min(2).max(20),
  address: z.string().min(10).max(120),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ ok: false, message: "BAD_REQUEST" }, { status: 400 });

  const chain = normalizeChain(body.data.chain);
  const address = normalizeAddress(chain, body.data.address);
  if (!address) return Response.json({ ok: false, message: "INVALID_ADDRESS" }, { status: 400 });

  const rl = await rateLimit(`walletlink:${userId}`, 10, 60_000);
  if (!rl.ok) return Response.json({ ok: false, message: "RATE_LIMIT" }, { status: 429 });

  const nonce = randomNonce();
  const issuedAtIso = new Date().toISOString();
  const message = makeWalletLinkMessage({ userId, chain, address, nonce, issuedAtIso });

  const redis = getRedis();
  const key = `videoshare:walletlink:nonce:${userId}:${chain}:${address}`;
  if (redis) {
    await redis.set(key, nonce, "PX", 10 * 60_000);
  } else {
    // If Redis missing (install wizard), still return but verification will fail safely.
  }

  return Response.json({ ok: true, chain, address, nonce, issuedAtIso, message });
}
