import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";
import { normalizeAddress, normalizeChain, makeWalletLinkMessage } from "@/lib/walletLink";
import { queues } from "@/lib/queues";
import { z } from "zod";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { ethers } from "ethers";

export const runtime = "nodejs";

const bodySchema = z.object({
  chain: z.string().min(2).max(20),
  address: z.string().min(10).max(120),
  message: z.string().min(10).max(1000),
  signature: z.string().min(10).max(5000),
  signatureEncoding: z.enum(["base64", "base58", "hex"]).optional(),
});

function decodeSolanaSignature(sig: string, enc?: string) {
  const s = String(sig || "").trim();
  try {
    if (enc === "base58") return bs58.decode(s);
    if (enc === "base64") return Uint8Array.from(Buffer.from(s, "base64"));
    // auto
    if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return bs58.decode(s);
    return Uint8Array.from(Buffer.from(s, "base64"));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const rl = await rateLimit(`walletlink:${userId}`, 20, 60_000);
  if (!rl.ok) return Response.json({ ok: false, message: "RATE_LIMIT" }, { status: 429 });

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ ok: false, message: "BAD_REQUEST" }, { status: 400 });

  const chain = normalizeChain(body.data.chain);
  const address = normalizeAddress(chain, body.data.address);
  const message = String(body.data.message || "");

  // Validate nonce from Redis
  const redis = getRedis();
  const key = `videoshare:walletlink:nonce:${userId}:${chain}:${address}`;
  const nonce = redis ? (await redis.get(key)) : null;
  if (!nonce) return Response.json({ ok: false, message: "CHALLENGE_EXPIRED" }, { status: 400 });

  const expectedPrefix = "VideoShare Wallet Link";
  if (!message.startsWith(expectedPrefix)) return Response.json({ ok: false, message: "INVALID_MESSAGE" }, { status: 400 });
  if (!message.includes(`userId=${userId}`) || !message.includes(`chain=${chain}`) || !message.toLowerCase().includes(`address=${address}`)) {
    return Response.json({ ok: false, message: "INVALID_MESSAGE" }, { status: 400 });
  }
  if (!message.includes(`nonce=${nonce}`)) return Response.json({ ok: false, message: "INVALID_NONCE" }, { status: 400 });

  // Verify signature
  let okSig = false;
  try {
    if (chain === "SOLANA") {
      const sigBytes = decodeSolanaSignature(body.data.signature, body.data.signatureEncoding);
      const pkBytes = bs58.decode(address);
      const msgBytes = new TextEncoder().encode(message);
      okSig = Boolean(sigBytes && nacl.sign.detached.verify(msgBytes, sigBytes, pkBytes));
    } else {
      const recovered = ethers.verifyMessage(message, body.data.signature);
      okSig = normalizeAddress(chain, recovered) === address;
    }
  } catch {
    okSig = false;
  }
  if (!okSig) return Response.json({ ok: false, message: "SIGNATURE_INVALID" }, { status: 400 });

  // Prevent linking the same wallet to multiple users
  const existing = await prisma.userWallet.findUnique({ where: { chain_address: { chain: chain as any, address } } }).catch(() => null);
  if (existing && existing.userId !== userId) return Response.json({ ok: false, message: "WALLET_ALREADY_LINKED" }, { status: 409 });

  const row = await prisma.userWallet.upsert({
    where: { chain_address: { chain: chain as any, address } },
    update: { userId, verifiedAt: new Date() },
    create: { userId, chain: chain as any, address, verifiedAt: new Date() },
    select: { id: true, chain: true, address: true },
  });

  if (redis) await redis.del(key);

  // Trigger fast sync
  await queues.nft.add(
    "nft_gate_sync",
    { reason: "wallet_linked", addresses: [{ chain: row.chain, address: row.address }] },
    { removeOnComplete: true, removeOnFail: 1000 }
  );

  return Response.json({ ok: true, wallet: row });
}
