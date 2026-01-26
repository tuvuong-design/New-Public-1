import { prisma } from "../../prisma";
import { env } from "../../env";
import { keccak_256 } from "@noble/hashes/sha3";
import { bigintFromHex, normalizeTronAddressToHex41 } from "../../lib/tron";

function bytesToHex(bytes: Uint8Array): string {
  let s = "0x";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

const TRANSFER_TOPIC0 = bytesToHex(keccak_256(new TextEncoder().encode("Transfer(address,address,uint256)")));

function normalizeEvmAddress(addr: string) {
  const a = String(addr || "").trim();
  if (!a) return "";
  const m = a.match(/^0x[0-9a-fA-F]{40}$/);
  if (!m) throw new Error("INVALID_EVM_ADDRESS");
  return a.toLowerCase();
}

function zeroPadTopicU256(hex: string) {
  const h = String(hex || "").toLowerCase();
  if (!h.startsWith("0x")) throw new Error("INVALID_HEX");
  const body = h.slice(2);
  if (body.length > 64) throw new Error("HEX_TOO_LONG");
  if (!/^[0-9a-f]*$/.test(body)) throw new Error("INVALID_HEX");
  return `0x${body.padStart(64, "0")}`;
}

function topicToAddress(topic: string) {
  const t = String(topic || "").toLowerCase();
  if (!t.startsWith("0x") || t.length !== 66) return "";
  const addr = `0x${t.slice(26)}`; // last 20 bytes
  if (!/^0x[0-9a-f]{40}$/.test(addr)) return "";
  return addr;
}

function getRpcUrl(chain: string) {
  switch (chain) {
    case "ETHEREUM":
      return env.EVM_RPC_URL_ETHEREUM || env.EVM_RPC_URL_POLYGON || "";
    case "POLYGON":
      return env.EVM_RPC_URL_POLYGON || "";
    case "BSC":
      return env.EVM_RPC_URL_BSC || "";
    case "BASE":
      return env.EVM_RPC_URL_BASE || "";
    default:
      return "";
  }
}

async function tronGridGetEventsByTx(txid: string): Promise<any[]> {
  const base = env.TRONGRID_API_URL || "https://api.trongrid.io";
  const url = `${base.replace(/\/$/, "")}/v1/transactions/${encodeURIComponent(txid)}/events?only_confirmed=true`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = env.TRONGRID_API_KEY;
  const res = await fetch(url, { headers });
  const j = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new Error(`TRONGRID_HTTP_${res.status}`);
  const arr = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
  return arr;
}

async function jsonRpc(rpcUrl: string, method: string, params: any[]) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await res.json().catch(() => null)) as any;
  if (!res.ok || j?.error) throw new Error(`RPC_ERROR:${j?.error?.message || res.status}`);
  return j?.result;
}

function parseMintedRefWallet(mintedRef: string | null | undefined) {
  if (!mintedRef) return "";
  try {
    const j = JSON.parse(mintedRef) as any;
    const wa = String(j?.walletAddress || "").trim();
    return wa;
  } catch {
    const m = String(mintedRef).match(/walletAddress=([^\s]+)/);
    return (m?.[1] || "").trim();
  }
}

function parseMintedRefMintAddress(mintedRef: string | null | undefined) {
  if (!mintedRef) return "";
  try {
    const j = JSON.parse(mintedRef) as any;
    const ma = String(j?.mintAddress || "").trim();
    return ma;
  } catch {
    const m = String(mintedRef).match(/mintAddress=([^\s]+)/);
    return (m?.[1] || "").trim();
  }
}

async function verifySolanaMint(args: { txHash: string; walletAddress: string; mintAddress?: string }): Promise<{ ok: boolean; mintAddress?: string }> {
  if (!env.SOLANA_RPC_URL) throw new Error("SOLANA_RPC_URL_MISSING");
  const result = await jsonRpc<any>(env.SOLANA_RPC_URL, "getTransaction", [
    args.txHash,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
  ]);
  if (!result) throw new Error("RECEIPT_NOT_FOUND");
  if (result?.meta?.err) throw new Error("TX_FAILED");

  const wallet = String(args.walletAddress || "").trim();
  if (!wallet) throw new Error("WALLET_MISSING");

  const preTB: any[] = result?.meta?.preTokenBalances || [];
  const postTB: any[] = result?.meta?.postTokenBalances || [];

  const toBig = (it: any) => {
    const amt = String(it?.uiTokenAmount?.amount ?? "0");
    return amt && /^[0-9]+$/.test(amt) ? BigInt(amt) : 0n;
  };

  const sumByMintForWallet = (arr: any[]) => {
    const m = new Map<string, bigint>();
    for (const it of arr) {
      if (String(it?.owner || "").trim() !== wallet) continue;
      const mint = String(it?.mint || "").trim();
      if (!mint) continue;
      m.set(mint, (m.get(mint) || 0n) + toBig(it));
    }
    return m;
  };

  const preMap = sumByMintForWallet(preTB);
  const postMap = sumByMintForWallet(postTB);

  const wantedMint = String(args.mintAddress || "").trim();
  if (wantedMint) {
    const pre = preMap.get(wantedMint) || 0n;
    const post = postMap.get(wantedMint) || 0n;
    return { ok: post > pre, mintAddress: wantedMint };
  }

  // Auto-detect: choose any mint where post > pre, pick the largest delta
  let bestMint = "";
  let bestDelta = 0n;
  for (const [mint, post] of postMap.entries()) {
    const pre = preMap.get(mint) || 0n;
    const delta = post - pre;
    if (delta > bestDelta) {
      bestDelta = delta;
      bestMint = mint;
    }
  }
  if (bestMint && bestDelta > 0n) return { ok: true, mintAddress: bestMint };
  return { ok: false };
}

async function verifyTronTransfer(args: { txHash: string; contractAddress: string; tokenIdHex: string; walletAddress?: string }): Promise<boolean> {
  const wantedTokenId = bigintFromHex(args.tokenIdHex);
  const wantedContract = normalizeTronAddressToHex41(args.contractAddress);
  const wantedWallet = args.walletAddress ? normalizeTronAddressToHex41(args.walletAddress) : "";

  const events = await tronGridGetEventsByTx(args.txHash);
  for (const e of events) {
    const name = String(e?.event_name || e?.eventName || "").toLowerCase();
    if (!name) continue;
    if (!name.includes("transfer")) continue;

    let contract = "";
    try {
      contract = normalizeTronAddressToHex41(String(e?.contract_address || e?.contractAddress || ""));
    } catch {
      continue;
    }
    if (contract !== wantedContract) continue;

    const r = e?.result || e?.event_result || e?.data || {};
    const tokenRaw = r?.tokenId ?? r?.token_id ?? r?._tokenId ?? r?.id ?? r?.value;
    if (tokenRaw == null) continue;
    let tokenId: bigint;
    try {
      tokenId = typeof tokenRaw === "string" && tokenRaw.startsWith("0x") ? bigintFromHex(tokenRaw) : BigInt(String(tokenRaw));
    } catch {
      continue;
    }
    if (tokenId !== wantedTokenId) continue;

    if (wantedWallet) {
      const toRaw = r?.to ?? r?.to_address ?? r?.recipient ?? r?.receiver;
      if (!toRaw) continue;
      let toHex = "";
      try {
        toHex = normalizeTronAddressToHex41(String(toRaw));
      } catch {
        continue;
      }
      if (toHex !== wantedWallet) continue;
    }

    return true;
  }
  return false;
}

export async function nftExportVerifyTxJob(exportRequestId: string) {
  const req = await prisma.nftExportRequest.findUnique({
    where: { id: exportRequestId },
    include: { item: { select: { id: true } } },
  });
  if (!req) throw new Error("EXPORT_REQUEST_NOT_FOUND");
  if (req.status !== "READY") return { ok: true, skipped: true };
  if (!req.txHash) throw new Error("TX_HASH_MISSING");
  if (!req.contractAddress) throw new Error("CONTRACT_MISSING");
  if (!req.tokenIdHex) throw new Error("TOKENID_MISSING");

  const chain = String(req.chain);

  const walletRaw = parseMintedRefWallet(req.mintedRef);

  if (chain === "SOLANA") {
    const mintAddress = parseMintedRefMintAddress(req.mintedRef);
    const sol = await verifySolanaMint({ txHash: req.txHash, walletAddress: walletRaw, mintAddress: mintAddress || undefined });
    if (!sol.ok) throw new Error("TRANSFER_NOT_FOUND");
    // If mintAddress was not provided, persist detected mint for future UI/audit
    if (!mintAddress && sol.mintAddress) {
      try {
        const j = JSON.parse(req.mintedRef || "{}") as any;
        req.mintedRef = JSON.stringify({ ...j, mintAddress: sol.mintAddress });
      } catch {
        req.mintedRef = JSON.stringify({ mintedRef: req.mintedRef, mintAddress: sol.mintAddress });
      }
    }
  } else if (chain === "TRON") {
    const ok = await verifyTronTransfer({ txHash: req.txHash, contractAddress: req.contractAddress, tokenIdHex: req.tokenIdHex, walletAddress: walletRaw || undefined });
    if (!ok) throw new Error("TRANSFER_NOT_FOUND");
  } else {
    const rpcUrl = getRpcUrl(chain);
    if (!rpcUrl) throw new Error("RPC_URL_MISSING");

    const receipt = await jsonRpc(rpcUrl, "eth_getTransactionReceipt", [req.txHash]);
    if (!receipt) throw new Error("RECEIPT_NOT_FOUND");

    const contract = normalizeEvmAddress(req.contractAddress);
    const wallet = walletRaw ? normalizeEvmAddress(walletRaw) : "";

    const tokenTopic = zeroPadTopicU256(req.tokenIdHex).toLowerCase();

    const logs: any[] = Array.isArray(receipt.logs) ? receipt.logs : [];
    const match = logs.find((l) => {
      try {
        if (!l?.topics || l.topics.length < 4) return false;
        if (String(l.address).toLowerCase() !== contract) return false;
        if (String(l.topics[0]).toLowerCase() !== TRANSFER_TOPIC0.toLowerCase()) return false;
        // topics[1]=from, topics[2]=to, topics[3]=tokenId
        if (String(l.topics[3]).toLowerCase() !== tokenTopic) return false;
        if (wallet) {
          const toAddr = topicToAddress(String(l.topics[2]));
          if (!toAddr || toAddr !== wallet) return false;
        }
        return true;
      } catch {
        return false;
      }
    });

    if (!match) throw new Error("TRANSFER_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    const base = (() => {
      try {
        return JSON.parse(req.mintedRef || "{}") as any;
      } catch {
        return {};
      }
    })();
    await tx.nftExportRequest.update({ where: { id: req.id }, data: { status: "EXPORTED", mintedRef: JSON.stringify({ ...base, walletAddress: walletRaw, verifiedAt: new Date().toISOString() }) } });
    if (req.itemId) {
      await tx.nftItem.update({ where: { id: req.itemId }, data: { exportStatus: "EXPORTED", marketplaceFrozen: true } });
    }
    await tx.nftEventLog.create({
      data: { actorId: req.userId, action: "NFT_EXPORT_VERIFIED", dataJson: JSON.stringify({ exportRequestId: req.id, txHash: req.txHash, contractAddress: req.contractAddress, tokenIdHex: req.tokenIdHex, walletAddress: walletRaw }) },
    });
  });

  return { ok: true, exported: true };
}
