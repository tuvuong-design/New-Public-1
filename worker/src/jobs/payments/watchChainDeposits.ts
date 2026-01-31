import type { Chain, Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { env } from "../../env";
import { jsonRpc, hexToBigInt, topicToAddress } from "./rpc";
import { paymentsQueue } from "../../queues";

const ERC20_TRANSFER_TOPIC0 = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function isEvm(chain: Chain) {
  return chain === "ETHEREUM" || chain === "POLYGON" || chain === "BSC" || chain === "BASE";
}

function rpcUrlForChain(chain: Chain): string {
  switch (chain) {
    case "BSC":
      return env.EVM_RPC_URL_BSC;
    case "ETHEREUM":
      return env.EVM_RPC_URL_ETHEREUM;
    case "POLYGON":
      return env.EVM_RPC_URL_POLYGON;
    case "BASE":
      return env.EVM_RPC_URL_BASE;
    default:
      return "";
  }
}

function addressToTopic(chain: Chain, addr: string) {
  const a = (addr || "").trim();
  const lower = isEvm(chain) ? a.toLowerCase() : a;
  // topic is 32-byte left-padded hex address
  const hex = lower.startsWith("0x") ? lower.slice(2) : lower;
  return "0x" + hex.padStart(64, "0");
}

function pickStableSymbol(sym: string) {
  const s = (sym || "").toUpperCase().trim();
  return s === "USDT" || s === "USDC" ? s : null;
}

function getSolanaMemoFromTx(tx: any): string | null {
  const ix = tx?.transaction?.message?.instructions;
  if (!Array.isArray(ix)) return null;
  for (const ins of ix) {
    const parsed = (ins as any)?.parsed;
    // Some RPC providers return memo as { type: 'memo', info: { memo: '...' } }
    if (parsed && typeof parsed === "object") {
      const memo = (parsed as any)?.info?.memo ?? (parsed as any)?.memo;
      if (typeof memo === "string" && memo.length) return memo;
    }
    if (typeof parsed === "string" && parsed.length) return parsed;
  }
  return null;
}

function getSolanaTokenDeltaToOwner(tx: any, owner: string, mint: string): { amountStr: string | null; rawDelta: bigint } {
  const pre = Array.isArray(tx?.meta?.preTokenBalances) ? tx.meta.preTokenBalances : [];
  const post = Array.isArray(tx?.meta?.postTokenBalances) ? tx.meta.postTokenBalances : [];
  // Map by (owner+mint) sum uiAmountString deltas
  function uiToBigInt(ui: any, decimals: number): bigint {
    // uiTokenAmount: { amount: '123', decimals: 6 } where amount is raw integer string
    const amtStr = ui?.amount;
    if (!amtStr) return 0n;
    try { return BigInt(amtStr); } catch { return 0n; }
  }

  // Build maps: accountIndex->(owner,mint,rawAmount)
  const preMap = new Map<string, bigint>();
  for (const b of pre) {
    if ((b?.owner || "") !== owner) continue;
    if ((b?.mint || "") !== mint) continue;
    const decimals = Number(b?.uiTokenAmount?.decimals ?? 0);
    const raw = uiToBigInt(b?.uiTokenAmount, decimals);
    preMap.set(`${b.accountIndex}`, raw);
  }
  let delta = 0n;
  let decimals = 0;
  for (const b of post) {
    if ((b?.owner || "") !== owner) continue;
    if ((b?.mint || "") !== mint) continue;
    decimals = Number(b?.uiTokenAmount?.decimals ?? 0);
    const raw = uiToBigInt(b?.uiTokenAmount, decimals);
    const prev = preMap.get(`${b.accountIndex}`) ?? 0n;
    delta += raw - prev;
  }
  if (delta <= 0n) return { amountStr: null, rawDelta: delta };
  const base = 10n ** BigInt(decimals);
  const whole = delta / base;
  const frac = delta % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const amountStr = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
  return { amountStr, rawDelta: delta };
}

async function watchSolanaStableDeposits() {
  await setCursor("SOLANA" as Chain, "lastRun", null, new Date().toISOString()).catch(() => null);

  if (!env.SOLANA_RPC_URL) return;

  const chain: Chain = "SOLANA";
  // Find stable tokens configured in DB (USDT/USDC mints stored in Token.contractAddress)
  const tokens = await prisma.token.findMany({
    where: { chain, active: true, symbol: { in: ["USDT", "USDC"] } },
    select: { id: true, symbol: true, contractAddress: true, decimals: true },
  });
  if (!tokens.length) return;

  for (const token of tokens) {
    const mint = token.contractAddress;
    if (!mint) continue;

    const deposits = await prisma.starDeposit.findMany({
      where: {
        chain,
        tokenId: token.id,
        status: { in: ["CREATED", "SUBMITTED", "OBSERVED"] as any },
        creditedAt: null,
      },
      include: { custodialAddress: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    for (const dep of deposits) {
      if (dep.txHash) continue;
      const address = dep.custodialAddress?.address;
      if (!address) continue;

      // Pull recent signatures for the custodial address
      const sigs = await jsonRpc<any[]>(env.SOLANA_RPC_URL, "getSignaturesForAddress", [address, { limit: 25 }]).catch(() => []);
      if (!Array.isArray(sigs) || sigs.length === 0) continue;

      for (const s of sigs) {
        const sig = (s?.signature || "").toString();
        if (!sig) continue;

        const tx = await jsonRpc<any>(env.SOLANA_RPC_URL, "getTransaction", [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null);
        if (!tx) continue;
        if (tx?.meta?.err) continue;

        // If deposit has memo: require matching memo
        if (dep.memo) {
          const memo = getSolanaMemoFromTx(tx);
          if (memo !== dep.memo) continue;
        }

        const delta = getSolanaTokenDeltaToOwner(tx, address, mint);
        if (!delta.amountStr) continue;

        await prisma.starDeposit.update({
          where: { id: dep.id },
          data: {
            provider: "HELIUS",
            txHash: sig,
            actualAmount: new Prisma.Decimal(delta.amountStr),
            status: "OBSERVED",
          } as any,
        }).catch(() => null);

        await enqueueReconcile(dep.id);
        break;
      }
    }
  }
}

async function getCursor(chain: Chain, key: string, tokenId: string | null): Promise<string | null> {
  const row = await prisma.chainWatcherCursor.findUnique({
    where: { chain_tokenId_key: { chain, tokenId, key } },
    select: { value: true },
  }).catch(() => null);
  return row?.value ?? null;
}

async function setCursor(chain: Chain, key: string, tokenId: string | null, value: string) {
  await prisma.chainWatcherCursor.upsert({
    where: { chain_tokenId_key: { chain, tokenId, key } },
    create: { chain, tokenId, key, value },
    update: { value },
  }).catch(() => null);
}

async function enqueueReconcile(depositId: string) {
  // jobId dedupe to avoid spam
  await paymentsQueue.add(
    "reconcile_deposit",
    { depositId },
    { jobId: `reconcile_deposit:${depositId}`, removeOnComplete: true, removeOnFail: 1000 }
  ).catch(() => null);
}

/**
 * BSC/EVM polling watcher:
 * - Scan Transfer logs for USDT/USDC to custodial addresses of pending deposits
 * - When found: write txHash + actualAmount, then enqueue reconcile job
 *
 * Requires: EVM_RPC_URL_BSC (or other chain RPC), Token rows (USDT/USDC) with contractAddress+decimals
 */
async function watchEvmStableDeposits(chain: Chain) {
  await setCursor(chain, "lastRun", null, new Date().toISOString()).catch(() => null);

  const url = rpcUrlForChain(chain);
  if (!url) return;

  // Find stable tokens configured in DB
  const tokens = await prisma.token.findMany({
    where: { chain, active: true, symbol: { in: ["USDT", "USDC"] } },
    select: { id: true, symbol: true, contractAddress: true, decimals: true },
  });
  const curBlockHex = await jsonRpc<string>(url, "eth_blockNumber", []);
  const curBlock = Number(hexToBigInt(curBlockHex || "0x0"));
  const confirmations = env.PAYMENTS_EVM_CONFIRMATIONS;
  const safeBlock = Math.max(0, curBlock - confirmations);

  const window = env.PAYMENTS_WATCH_BLOCK_WINDOW;
  for (const token of tokens) {
    if (!token.contractAddress) continue;

    const last = await getCursor(chain, "lastBlock", token.id);
    const lastBlock = last ? Number(last) : Math.max(0, safeBlock - window);
    const fromBlock = Math.max(0, lastBlock + 1);
    const toBlock = safeBlock;
    if (toBlock < fromBlock) continue;

    // Load pending deposits for this token
    const deposits = await prisma.starDeposit.findMany({
      where: {
        chain,
        tokenId: token.id,
        status: { in: ["CREATED", "SUBMITTED", "OBSERVED"] as any },
        creditedAt: null,
      },
      include: { custodialAddress: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const addrSet = new Map<string, string>(); // address -> depositId (newest)
    for (const d of deposits) {
      const a = (d.custodialAddress?.address || "").toLowerCase();
      if (!a) continue;
      if (!addrSet.has(a)) addrSet.set(a, d.id);
    }
    const addresses = Array.from(addrSet.keys());
    if (!addresses.length) {
      await setCursor(chain, "lastBlock", token.id, String(toBlock));
      continue;
    }

    // Chunk addresses to keep topics size reasonable
    const chunkSize = 20;
    for (let i = 0; i < addresses.length; i += chunkSize) {
      const chunk = addresses.slice(i, i + chunkSize);
      const topics2 = chunk.map((a) => addressToTopic(chain, a));
      const params = [{
        fromBlock: "0x" + fromBlock.toString(16),
        toBlock: "0x" + toBlock.toString(16),
        address: token.contractAddress.toLowerCase(),
        topics: [ERC20_TRANSFER_TOPIC0, null, topics2],
      }];

      const logs = await jsonRpc<any[]>(url, "eth_getLogs", params).catch(() => []);
      if (!Array.isArray(logs) || logs.length === 0) continue;

      for (const l of logs) {
        const txHash = (l.transactionHash || "").toString();
        const topics = Array.isArray(l.topics) ? l.topics : [];
        if (topics.length < 3) continue;
        const to = topicToAddress(topics[2]).toLowerCase();
        const depositId = addrSet.get(to);
        if (!depositId) continue;

        const amountRaw = hexToBigInt((l.data || "0x0") as string);
        // decimals
        const decimals = token.decimals ?? 6;
        const base = 10n ** BigInt(decimals);
        const whole = amountRaw / base;
        const frac = amountRaw % base;
        const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
        const amountStr = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();

        // Update deposit once (idempotent)
        await prisma.starDeposit.update({
          where: { id: depositId },
          data: {
            provider: "MANUAL",
            txHash,
            actualAmount: new Prisma.Decimal(amountStr),
            status: "OBSERVED",
          } as any,
        }).catch(() => null);

        await enqueueReconcile(depositId);
      }
    }

    await setCursor(chain, "lastBlock", token.id, String(toBlock));
  }
}

/**
 * TRON polling watcher (TronGrid):
 * - Query TRC20 transfers for custodial addresses of pending deposits
 * - Match by toAddress (TRON memo usually unavailable)
 * - Only USDT/USDC allowed (must exist in Token table)
 *
 * Requires: TRONGRID_API_URL + TRONGRID_API_KEY
 */
async function tronFetchJson(url: string): Promise<any> {
  const headers: Record<string,string> = {};
  if (env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = env.TRONGRID_API_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function watchTronStableDeposits() {
  await setCursor("TRON" as Chain, "lastRun", null, new Date().toISOString()).catch(() => null);

  const chain: Chain = "TRON";
  const baseUrl = (env.TRONGRID_API_URL || "https://api.trongrid.io").replace(/\/$/, "");

  const tokens = await prisma.token.findMany({
    where: { chain, active: true, symbol: { in: ["USDT", "USDC"] } },
    select: { id: true, symbol: true, contractAddress: true, decimals: true },
  });
  if (!tokens.length) return;

  // pending deposits
  const deposits = await prisma.starDeposit.findMany({
    where: { chain, tokenId: { in: tokens.map(t => t.id) }, status: { in: ["CREATED", "SUBMITTED", "OBSERVED"] as any }, creditedAt: null },
    include: { custodialAddress: true, token: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  for (const dep of deposits) {
    const addr = dep.custodialAddress?.address;
    if (!addr) continue;
    const token = dep.token;
    if (!token || !token.contractAddress) continue;

    // Cursor per deposit address+token
    const cursorKey = `lastTx:${dep.custodialAddressId}`;
    const lastTx = await getCursor(chain, cursorKey, token.id);

    const url = `${baseUrl}/v1/accounts/${encodeURIComponent(addr)}/transactions/trc20?limit=50&only_to=true&contract_address=${encodeURIComponent(token.contractAddress)}`;
    const data = await tronFetchJson(url);
    const items = Array.isArray(data?.data) ? data.data : [];
    for (const it of items) {
      const txHash = String(it.transaction_id || it.transactionId || it.hash || "");
      if (!txHash || (lastTx && txHash === lastTx)) break;

      const to = String(it.to || it.to_address || it.toAddress || "");
      if (!to) continue;
      if (to !== addr) continue;

      const sym = String(it.token_info?.symbol || it.token_symbol || "").toUpperCase();
      const stable = pickStableSymbol(sym) || pickStableSymbol(token.symbol);
      if (!stable) continue;

      const amountRaw = it.value ?? it.amount ?? it.quant ?? null;
      if (amountRaw == null) continue;

      const decimals = Number(it.token_info?.decimals ?? token.decimals ?? 6);
      // value often already string in base units
      const rawBig = BigInt(String(amountRaw));
      const base = 10n ** BigInt(decimals);
      const whole = rawBig / base;
      const frac = rawBig % base;
      const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
      const amountStr = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();

      await prisma.starDeposit.update({
        where: { id: dep.id },
        data: {
          provider: "TRONGRID",
          txHash,
          actualAmount: new Prisma.Decimal(amountStr),
          status: "OBSERVED",
        } as any,
      }).catch(() => null);

      await enqueueReconcile(dep.id);
      // update cursor
      await setCursor(chain, cursorKey, token.id, txHash);
      break;
    }
  }
}

export async function watchChainDepositsJob(input: { chain: Chain }) {
  if (input.chain === "TRON") return watchTronStableDeposits();
  if (input.chain === "SOLANA") return watchSolanaStableDeposits();
  if (isEvm(input.chain)) return watchEvmStableDeposits(input.chain);
}
