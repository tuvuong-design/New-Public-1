import crypto from "crypto";

export function normalizeChain(chain: string) {
  const c = String(chain || "").toUpperCase();
  if (["SOLANA","ETHEREUM","POLYGON","BSC","BASE","TRON"].includes(c)) return c;
  return "SOLANA";
}

export function normalizeAddress(chain: string, address: string) {
  const a = String(address || "").trim();
  if (!a) return "";
  // EVM addresses: lowercase checksum-insensitive
  if (chain !== "SOLANA") return a.toLowerCase();
  return a;
}

export function makeWalletLinkMessage(args: { userId: string; chain: string; address: string; nonce: string; issuedAtIso: string }) {
  return [
    "VideoShare Wallet Link",
    `userId=${args.userId}`,
    `chain=${args.chain}`,
    `address=${args.address}`,
    `nonce=${args.nonce}`,
    `issuedAt=${args.issuedAtIso}`,
  ].join("\n");
}

export function randomNonce() {
  return crypto.randomUUID();
}
