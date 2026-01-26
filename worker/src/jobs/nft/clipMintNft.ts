import { prisma } from "../../prisma";
import { env } from "../../env";
import { uploadBuffer, CACHE_CONTROL_IMMUTABLE } from "../../utils/r2io";
import { resolveMediaUrlWorker } from "../../lib/mediaUrlWorker";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";

function parseSolanaSecretKeyJson(s: string): Uint8Array {
  const raw = String(s || "").trim();
  if (!raw) throw new Error("SOLANA_MINT_AUTHORITY_SECRET_JSON missing");
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new Error("SOLANA_MINT_AUTHORITY_SECRET_JSON must be JSON array of numbers");
  }
  if (!Array.isArray(arr)) throw new Error("SOLANA_MINT_AUTHORITY_SECRET_JSON must be JSON array");
  const nums = arr.map((x) => Number(x));
  if (nums.some((n) => !Number.isFinite(n))) throw new Error("SOLANA_MINT_AUTHORITY_SECRET_JSON has non-numeric values");
  return Uint8Array.from(nums);
}

function clipMetadataKey(clipId: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `nft/clip/${clipId}/metadata/${ts}.json`;
}

export async function clipMintNftJob(data: { clipId: string }) {
  const clipId = String(data.clipId || "");
  if (!clipId) throw new Error("clipId required");

  const clipNft = await prisma.clipNft.findUnique({
    where: { clipId },
    include: {
      clip: { include: { video: { select: { id: true, title: true, thumbKey: true } }, creator: { select: { id: true, name: true } } } },
      mints: true,
    },
  } as any);

  if (!clipNft) throw new Error("ClipNft not found. Ensure mode is SEPARATE_ONLY or BOTH and mint was initialized.");
  if (clipNft.status === "MINTED") return { ok: true, status: "MINTED" };

  // Mark attempt
  await prisma.clipNft.update({
    where: { id: clipNft.id },
    data: {
      status: "SUBMITTED",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null,
    },
  });

  try {
    if (!env.SOLANA_RPC_URL) throw new Error("SOLANA_RPC_URL missing");
    if (String(env.SOLANA_NFT_MINT_ENABLED) !== "true") throw new Error("SOLANA_NFT_MINT_ENABLED=false (disabled)");

    const secret = parseSolanaSecretKeyJson(env.SOLANA_MINT_AUTHORITY_SECRET_JSON);
    const kp = Keypair.fromSecretKey(secret);

    const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
    const mx = Metaplex.make(connection).use(keypairIdentity(kp));

    // Recipient: creator's linked SOL wallet (if any), else mint authority.
    const creatorWallet = await prisma.userWallet.findFirst({
      where: { userId: clipNft.clip.creatorId, chain: "SOLANA" as any, verifiedAt: { not: null } },
      orderBy: { verifiedAt: "desc" },
      select: { address: true },
    });
    const recipient = new PublicKey(creatorWallet?.address || kp.publicKey.toBase58());

    const videoTitle = clipNft.clip.video?.title || "Video";
    const clipTitle = clipNft.clip.title || `Clip ${clipNft.clip.id}`;

    const imageUrl = resolveMediaUrlWorker(clipNft.clip.video?.thumbKey) || resolveMediaUrlWorker(clipNft.clip.outputKey) || undefined;
    const animationUrl = resolveMediaUrlWorker(clipNft.clip.outputKey) || undefined;

    const metadata = {
      name: `${clipTitle}`,
      symbol: "CLIP",
      description: `Highlight clip from: ${videoTitle}`,
      image: imageUrl,
      animation_url: animationUrl,
      attributes: [
        { trait_type: "VideoId", value: clipNft.clip.videoId },
        { trait_type: "ClipId", value: clipNft.clip.id },
        { trait_type: "StartSec", value: clipNft.clip.startSec },
        { trait_type: "EndSec", value: clipNft.clip.endSec },
      ],
      properties: {
        category: "video",
        files: [
          ...(imageUrl ? [{ uri: imageUrl, type: "image/png" }] : []),
          ...(animationUrl ? [{ uri: animationUrl, type: "video/mp4" }] : []),
        ],
      },
      seller_fee_basis_points: clipNft.royaltyBps,
    };

    const key = clipMetadataKey(clipId);
    await uploadBuffer(key, Buffer.from(JSON.stringify(metadata, null, 2)), "application/json", { cacheControl: CACHE_CONTROL_IMMUTABLE });

    const uri = `${env.R2_PUBLIC_BASE_URL}/${key}`;

    // Limited editions: mint N separate NFTs with the same metadata URI.
    const desired = Math.max(1, Math.min(100, clipNft.editionSize || 1));
    const existingSerials = new Set<number>((clipNft.mints || []).map((m: any) => Number(m.serial)));

    const minted: { serial: number; mintAddress: string; txHash?: string }[] = [];

    for (let serial = 1; serial <= desired; serial++) {
      if (existingSerials.has(serial)) continue;
      const name = desired > 1 ? `${clipTitle} #${serial}/${desired}` : clipTitle;

      const res = await mx.nfts().create(
        {
          uri,
          name,
          symbol: "CLIP",
          sellerFeeBasisPoints: clipNft.royaltyBps,
          tokenOwner: recipient,
        },
        { commitment: "confirmed" }
      );

      const mintAddress = res.nft.address.toBase58();
      const txHash = (res as any)?.response?.signature as string | undefined;

      await prisma.clipNftMint.create({
        data: {
          clipNftId: clipNft.id,
          serial,
          mintAddress,
          txHash: txHash || null,
        },
      });
      minted.push({ serial, mintAddress, txHash });
    }

    const first = (clipNft.mints?.[0] as any) || minted[0];

    await prisma.clipNft.update({
      where: { id: clipNft.id },
      data: {
        status: "MINTED",
        metadataKey: key,
        thumbKey: clipNft.clip.video?.thumbKey || clipNft.clip.outputKey,
        mintAddress: first?.mintAddress || clipNft.mintAddress,
        txHash: first?.txHash || clipNft.txHash,
        lastError: null,
      },
    });

    return { ok: true, mintedCount: minted.length, desired, metadataKey: key };
  } catch (e: any) {
    await prisma.clipNft.update({
      where: { id: clipNft.id },
      data: {
        status: "FAILED",
        lastError: String(e?.message || e),
      },
    });
    throw e;
  }
}
