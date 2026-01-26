import { keccak_256 } from "@noble/hashes/sha3";

const CHAIN_ID: Record<string, bigint> = {
  ETHEREUM: 1n,
  POLYGON: 137n,
  BSC: 56n,
  BASE: 8453n,
  // Non-EVM chains: we still need a stable deterministic namespace.
  // Solana doesn't use an EVM-style chainId; we use a stable constant for mainnet namespace.
  SOLANA: 101n,
  // TRON mainnet chain ID (EIP-155 style, via JSON-RPC eth_chainId).
  TRON: 728126428n,
};

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function bigintToU256Bytes(v: bigint): Uint8Array {
  if (v < 0n) throw new Error("NEGATIVE_BIGINT");
  let hex = v.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  // left pad to 32 bytes
  const out = new Uint8Array(32);
  out.set(bytes, 32 - bytes.length);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "0x";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/**
 * Deterministic tokenId per spec:
 *   tokenId = uint256(keccak256(abi.encodePacked("SRNFT:", chainid, nftId)))
 */
export function deterministicTokenIdHex(args: { chain: string; nftId: string }) {
  const chainId = CHAIN_ID[String(args.chain || "").toUpperCase()] ?? 0n;

  // approximate abi.encodePacked as:
  // bytes("SRNFT:") + uint256(chainId) (32-byte big-endian) + bytes(nftId)
  const prefix = utf8Bytes("SRNFT:");
  const chainBytes = bigintToU256Bytes(chainId);
  const idBytes = utf8Bytes(String(args.nftId));
  const packed = concatBytes([prefix, chainBytes, idBytes]);
  const hash = keccak_256(packed);
  return bytesToHex(hash);
}
