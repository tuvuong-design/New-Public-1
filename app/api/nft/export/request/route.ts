import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSiteConfig } from "@/lib/siteConfig";
import { enqueueNftExportPrepare } from "@/lib/nft/exportQueue";
import { deterministicTokenIdHex } from "@/lib/nft/tokenId";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function cleanAddr(s: string) {
  return String(s || "").trim();
}

function isEvmChain(chain: string) {
  return chain === "ETHEREUM" || chain === "POLYGON" || chain === "BSC" || chain === "BASE";
}

function validateWalletAddress(chain: string, walletAddress: string) {
  const wa = cleanAddr(walletAddress);
  if (!wa) throw new Error("WALLET_ADDRESS_REQUIRED");

  if (isEvmChain(chain)) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(wa)) throw new Error("INVALID_EVM_ADDRESS");
    return wa.toLowerCase();
  }

  if (chain === "TRON") {
    // Accept base58 (T...) or hex (41...) formats.
    if (!/^T[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(wa) && !/^(0x)?41[0-9a-fA-F]{40}$/.test(wa)) {
      throw new Error("INVALID_TRON_ADDRESS");
    }
    return wa;
  }

  if (chain === "SOLANA") {
    // Basic base58 pubkey shape check (full validation happens in worker verify step).
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wa)) throw new Error("INVALID_SOLANA_ADDRESS");
    return wa;
  }

  return wa;
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData();
  const itemId = String(form.get("itemId") || "").trim();
  const back = String(form.get("back") || req.headers.get("referer") || (itemId ? `/nft/items/${itemId}` : "/nft"));

  const chain = String(form.get("chain") || "POLYGON").trim();
  const metadataStrategy = String(form.get("metadataStrategy") || "PUBLIC_URL").trim();
  const includeVideoInIpfs = String(form.get("includeVideoInIpfs") || "") === "1";
  const walletAddressRaw = cleanAddr(String(form.get("walletAddress") || ""));

  if (!itemId) return Response.json({ error: "ITEM_ID_REQUIRED" }, { status: 400 });
  if (!walletAddressRaw) return Response.json({ error: "WALLET_ADDRESS_REQUIRED" }, { status: 400 });

  const allowedChains = new Set(["SOLANA", "ETHEREUM", "POLYGON", "BSC", "BASE", "TRON"]);
  const allowedStrategies = new Set(["PUBLIC_URL", "IPFS_MEDIA"]);
  if (!allowedChains.has(chain)) return Response.json({ error: "CHAIN_NOT_ALLOWED" }, { status: 400 });

  // SOLANA/TRON require their respective RPC / API configured.
  if (chain === "SOLANA" && !env.SOLANA_RPC_URL) {
    return Response.json({ error: "SOLANA_RPC_URL_MISSING" }, { status: 400 });
  }
  if (chain === "TRON" && !env.TRONGRID_API_URL) {
    return Response.json({ error: "TRONGRID_API_URL_MISSING" }, { status: 400 });
  }
  if (!allowedStrategies.has(metadataStrategy)) return Response.json({ error: "STRATEGY_NOT_ALLOWED" }, { status: 400 });

  let walletAddress = "";
  try {
    walletAddress = validateWalletAddress(chain, walletAddressRaw);
  } catch (e: any) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }

  const cfg = await getSiteConfig();
  const exportBaseFeeStars = Number((cfg as any).nftExportBaseFeeStars ?? 0);

  const res = await prisma.$transaction(async (tx) => {
    const item = await tx.nftItem.findUnique({
      where: { id: itemId },
      include: {
        listings: { where: { status: "ACTIVE" }, take: 1 },
        auctions: { where: { status: "ACTIVE" }, take: 1 },
        exportRequests: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!item) throw new Error("ITEM_NOT_FOUND");
    if (item.ownerId !== userId) throw new Error("FORBIDDEN");
    if (item.marketplaceFrozen || item.exportStatus !== "NONE") throw new Error("ALREADY_EXPORTED_OR_FROZEN");
    if (item.listings.length) throw new Error("HAS_ACTIVE_LISTING");
    if (item.auctions.length) throw new Error("HAS_ACTIVE_AUCTION");

    const primary = await tx.nftChainContract.findUnique({ where: { chain: chain as any } });
    const contractAddress = primary?.isPrimary ? primary.address : primary?.address;
    if (!contractAddress) throw new Error("CONTRACT_NOT_CONFIGURED");

    // Deterministic tokenId: uint256(keccak256(abi.encodePacked("SRNFT:", chainid, nftId)))
    const tokenIdHex = deterministicTokenIdHex({ chain, nftId: item.id });

    // Charge base fee (optional)
    if (exportBaseFeeStars > 0) {
      const u = await tx.user.findUnique({ where: { id: userId }, select: { starBalance: true } });
      if (!u) throw new Error("USER_NOT_FOUND");
      if ((u.starBalance ?? 0) < exportBaseFeeStars) throw new Error("INSUFFICIENT_STARS");
      await tx.user.update({ where: { id: userId }, data: { starBalance: { decrement: exportBaseFeeStars } } });
      await tx.starTransaction.create({
        data: {
          userId,
          type: "NFT_EXPORT",
          delta: -exportBaseFeeStars,
          stars: exportBaseFeeStars,
          quantity: 1,
          note: `NFT export base fee (item=${item.id})`,
        },
      });
    }

    const reqRow = await tx.nftExportRequest.create({
      data: {
        itemId,
        userId,
        chain: chain as any,
        metadataStrategy: metadataStrategy as any,
        includeVideoInIpfs,
        status: "PENDING",
        tokenIdHex,
        contractAddress,
        mintedRef: JSON.stringify({ walletAddress }),
      },
    });

    await tx.nftItem.update({ where: { id: itemId }, data: { exportStatus: "PENDING", exportChain: chain as any, marketplaceFrozen: true } });

    await tx.nftEventLog.create({
      data: {
        actorId: userId,
        action: "NFT_EXPORT_REQUEST_CREATED",
        dataJson: JSON.stringify({ exportRequestId: reqRow.id, itemId, chain, metadataStrategy, includeVideoInIpfs, contractAddress, tokenIdHex }),
      },
    });

    return { requestId: reqRow.id };
  });

  // Enqueue IPFS metadata prepare in worker.
  await enqueueNftExportPrepare(res.requestId);

  redirect(back);
}
