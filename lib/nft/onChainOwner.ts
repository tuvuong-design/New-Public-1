import { env } from "@/lib/env";
import { normalizeTronAddressToHex41, tronHex41ToBase58 } from "@/lib/tron";
import { redisGetJSON, redisSetJSON } from "@/lib/redis";

const OWNER_CACHE_TTL_SECONDS = 300;

function getRpcUrl(chain: string) {
  const c = String(chain || "").toUpperCase();
  switch (c) {
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

function normalizeEvmAddress(addr: string) {
  const a = String(addr || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error("INVALID_EVM_ADDRESS");
  return a.toLowerCase();
}

function padU256(hex: string) {
  const h = String(hex || "").toLowerCase();
  if (!h.startsWith("0x")) throw new Error("INVALID_HEX");
  const body = h.slice(2);
  if (!/^[0-9a-f]*$/.test(body)) throw new Error("INVALID_HEX");
  if (body.length > 64) throw new Error("HEX_TOO_LONG");
  return body.padStart(64, "0");
}

function parseOwnerOfResult(hex: string) {
  const h = String(hex || "").toLowerCase();
  if (!h.startsWith("0x") || h.length < 66) return "";
  const body = h.slice(2).padStart(64, "0");
  const addr = `0x${body.slice(24)}`;
  if (!/^0x[0-9a-f]{40}$/.test(addr)) return "";
  return addr;
}

/**
 * Read-only mirror helper for EXPORTED NFTs (EVM only).
 * Uses ERC721 ownerOf(tokenId) via JSON-RPC and caches in Redis.
 */
export async function getEvmNftOwnerCached(args: { chain: string; contractAddress: string; tokenIdHex: string }) {
  const chain = String(args.chain || "").toUpperCase();
  const contract = normalizeEvmAddress(args.contractAddress);
  const tokenIdHex = String(args.tokenIdHex || "");

  const cacheKey = `videoshare:nft:owner:v1:${chain}:${contract}:${tokenIdHex.toLowerCase()}`;
  const cached = await redisGetJSON<{ owner: string }>(cacheKey);
  if (cached?.owner) return cached.owner;

  const rpcUrl = getRpcUrl(chain);
  if (!rpcUrl) throw new Error("RPC_URL_MISSING");

  // ownerOf(uint256) selector: 0x6352211e
  const data = `0x6352211e${padU256(tokenIdHex)}`;
  const result = await jsonRpc(rpcUrl, "eth_call", [{ to: contract, data }, "latest"]);
  const owner = parseOwnerOfResult(String(result || ""));
  if (owner) await redisSetJSON(cacheKey, { owner }, OWNER_CACHE_TTL_SECONDS);
  return owner;
}


function padU256No0x(hex: string) {
  const h = String(hex || "").toLowerCase().startsWith("0x") ? String(hex).slice(2) : String(hex || "");
  const body = h.padStart(64, "0");
  return body;
}

async function tronTriggerConstantOwnerOf(trongridBase: string, contractHex41: string, tokenIdHex: string) {
  const url = `${trongridBase.replace(/\/$/, "")}/wallet/triggerconstantcontract`;
  const ownerAddress = "410000000000000000000000000000000000000000"; // dummy caller
  const body = {
    owner_address: contractHex41 || ownerAddress,
    contract_address: contractHex41,
    function_selector: "ownerOf(uint256)",
    parameter: padU256No0x(tokenIdHex),
    visible: false,
  };

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = env.TRONGRID_API_KEY;

  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
  if (!resp.ok) throw new Error(`TRONGRID_HTTP_${resp.status}`);
  return (await resp.json()) as any;
}

function parseTronOwnerOfResult(j: any): string {
  const cr = j?.constant_result?.[0];
  if (!cr || typeof cr !== "string") return "";
  const hex = cr.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(hex)) return "";
  // Take last 20 bytes and prefix 41
  const last40 = hex.length >= 40 ? hex.slice(-40) : hex;
  const hex41 = ("41" + last40).slice(0, 42);
  try {
    return tronHex41ToBase58(hex41);
  } catch {
    return hex41;
  }
}

export async function getTronNftOwnerCached(opts: { contract: string; tokenIdHex: string }) {
  const contractHex41 = normalizeTronAddressToHex41(opts.contract);
  const tokenIdHex = String(opts.tokenIdHex || "");
  const cacheKey = `videoshare:nft:owner:v1:TRON:${contractHex41}:${tokenIdHex.toLowerCase()}`;
  const cached = await redisGetJSON<{ owner: string }>(cacheKey);
  if (cached?.owner) return cached.owner;

  const base = env.TRONGRID_API_URL || "https://api.trongrid.io";
  const j = await tronTriggerConstantOwnerOf(base, contractHex41, tokenIdHex);
  const owner = parseTronOwnerOfResult(j);
  if (owner) await redisSetJSON(cacheKey, { owner }, OWNER_CACHE_TTL_SECONDS);
  return owner;
}
