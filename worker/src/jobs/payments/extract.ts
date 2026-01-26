import type { Chain, PaymentProvider } from "@prisma/client";

export type Observation = {
  provider: PaymentProvider;
  chain: Chain;
  txHash?: string;
  memo?: string;
  toAddress?: string;
  fromAddress?: string;
  amount?: number;
  tokenContract?: string;
  assetSymbol?: string;
  raw?: any;
};

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

function tryDecodeBase64ToUtf8(b64: string): string | null {
  try {
    const buf = Buffer.from(b64, "base64");
    const s = buf.toString("utf8");
    return s;
  } catch {
    return null;
  }
}

function pickString(x: any): string | undefined {
  return typeof x === "string" && x.trim() ? x.trim() : undefined;
}

export function extractObservations(provider: PaymentProvider, chain: Chain, payload: any): Observation[] {
  if (provider === "HELIUS" && chain === "SOLANA") {
    const list = Array.isArray(payload) ? payload : payload?.data && Array.isArray(payload.data) ? payload.data : [payload];
    const out: Observation[] = [];
    for (const tx of list) {
      const signature = pickString(tx?.signature) || pickString(tx?.transactionSignature);
      let memo: string | undefined = pickString(tx?.memo);

      // Try to locate memo instruction
      const instrs = tx?.transaction?.message?.instructions || tx?.instructions || [];
      if (!memo && Array.isArray(instrs)) {
        for (const i of instrs) {
          const pid = pickString(i?.programId) || pickString(i?.programIdIndex) || pickString(i?.programId?.toString?.());
          const program = pickString(i?.program);
          if (pid === MEMO_PROGRAM_ID || program?.toLowerCase().includes("memo")) {
            memo = pickString(i?.parsed) || pickString(i?.data);
            if (memo && memo.match(/^[a-z0-9]{20,}$/i)) break;
            const dataB64 = pickString(i?.data);
            if (dataB64) {
              const decoded = tryDecodeBase64ToUtf8(dataB64);
              if (decoded) {
                memo = decoded;
                break;
              }
            }
          }
        }
      }

      // Token transfers (SPL)
      const tokenTransfers = Array.isArray(tx?.tokenTransfers) ? tx.tokenTransfers : [];
      for (const tt of tokenTransfers) {
        const to = pickString(tt?.toUserAccount) || pickString(tt?.toAccount);
        const from = pickString(tt?.fromUserAccount) || pickString(tt?.fromAccount);
        const mint = pickString(tt?.mint);
        const amount = typeof tt?.tokenAmount === "number" ? tt.tokenAmount : typeof tt?.tokenAmount?.uiAmount === "number" ? tt.tokenAmount.uiAmount : undefined;
        if (!to || !signature) continue;
        out.push({ provider, chain, txHash: signature, memo, toAddress: to, fromAddress: from, amount, tokenContract: mint, raw: tt });
      }

      // Native SOL transfers
      const nativeTransfers = Array.isArray(tx?.nativeTransfers) ? tx.nativeTransfers : [];
      for (const nt of nativeTransfers) {
        const to = pickString(nt?.toUserAccount) || pickString(nt?.toAccount);
        const from = pickString(nt?.fromUserAccount) || pickString(nt?.fromAccount);
        const lamports = typeof nt?.amount === "number" ? nt.amount : undefined;
        if (!to || !signature) continue;
        out.push({ provider, chain, txHash: signature, memo, toAddress: to, fromAddress: from, amount: typeof lamports === "number" ? lamports / 1e9 : undefined, raw: nt });
      }

      // If no transfer entries, still produce a generic observation
      if (out.length === 0 && signature) {
        out.push({ provider, chain, txHash: signature, memo, raw: tx });
      }
    }
    return out;
  }

  if (provider === "ALCHEMY") {
    const activities = Array.isArray(payload?.event?.activity) ? payload.event.activity : Array.isArray(payload?.activity) ? payload.activity : [];
    const out: Observation[] = [];
    for (const a of activities) {
      const txHash = pickString(a?.hash) || pickString(a?.transactionHash);
      const to = pickString(a?.toAddress) || pickString(a?.to);
      const from = pickString(a?.fromAddress) || pickString(a?.from);
      const assetSymbol = pickString(a?.asset) || pickString(a?.tokenSymbol);
      const tokenContract = pickString(a?.rawContract?.address) || pickString(a?.contractAddress);
      const valueStr = pickString(a?.value) || pickString(a?.rawContract?.value);
      const amount = valueStr && !isNaN(Number(valueStr)) ? Number(valueStr) : undefined;
      out.push({ provider, chain, txHash, toAddress: to, fromAddress: from, amount, tokenContract, assetSymbol, raw: a });
    }
    return out.length ? out : [{ provider, chain, raw: payload }];
  }

  if (provider === "QUICKNODE") {
    // QuickNode can deliver different payloads depending on stream type.
    const out: Observation[] = [];

    // Generic EVM-like format
    const txs = Array.isArray(payload?.data?.transactions) ? payload.data.transactions : Array.isArray(payload?.transactions) ? payload.transactions : null;
    if (txs) {
      for (const t of txs) {
        const txHash = pickString(t?.hash) || pickString(t?.txHash) || pickString(t?.transactionHash);
        const to = pickString(t?.to) || pickString(t?.toAddress);
        const from = pickString(t?.from) || pickString(t?.fromAddress);
        const tokenContract = pickString(t?.tokenAddress) || pickString(t?.contractAddress);
        const assetSymbol = pickString(t?.symbol) || pickString(t?.asset);
        const amount = typeof t?.amount === "number" ? t.amount : typeof t?.value === "number" ? t.value : undefined;
        out.push({ provider, chain, txHash, toAddress: to, fromAddress: from, amount, tokenContract, assetSymbol, raw: t });
      }
      return out;
    }

    // If it is already Alchemy-like
    if (Array.isArray(payload?.event?.activity)) {
      return extractObservations("ALCHEMY", chain, payload);
    }

    return [{ provider, chain, raw: payload }];
  }

  if (provider === "TRONGRID" || chain === "TRON") {
    const txHash = pickString(payload?.transaction_id) || pickString(payload?.txID) || pickString(payload?.txid);
    const to = pickString(payload?.to) || pickString(payload?.to_address);
    const from = pickString(payload?.from) || pickString(payload?.from_address);
    const tokenContract = pickString(payload?.contract) || pickString(payload?.contract_address);
    const assetSymbol = pickString(payload?.asset) || pickString(payload?.symbol);
    const amount = typeof payload?.amount === "number" ? payload.amount : undefined;
    return [{ provider, chain: "TRON", txHash, toAddress: to, fromAddress: from, tokenContract, assetSymbol, amount, raw: payload }];
  }

  return [{ provider, chain, raw: payload }];
}
