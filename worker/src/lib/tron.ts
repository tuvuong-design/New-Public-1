import { base58CheckDecode } from "./base58check";

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/**
 * Normalize TRON address to lowercase hex string (41 + 20 bytes).
 * Accepts Base58 (T...), hex (41..), or 0x41.. formats.
 */
export function normalizeTronAddressToHex41(addr: string): string {
  const a = String(addr || "").trim();
  if (!a) return "";
  if (a.startsWith("T") && a.length >= 30) {
    const payload = base58CheckDecode(a);
    const hex = bytesToHex(payload);
    if (!hex.startsWith("41") || hex.length !== 42) throw new Error("TRON_ADDR_BAD_PAYLOAD");
    return hex.toLowerCase();
  }
  const h = a.toLowerCase().startsWith("0x") ? a.slice(2) : a;
  if (/^[0-9a-f]{42}$/.test(h) && h.startsWith("41")) return h.toLowerCase();
  throw new Error("INVALID_TRON_ADDRESS");
}

export function bigintFromHex(hex: string): bigint {
  const h = String(hex || "").toLowerCase();
  const body = h.startsWith("0x") ? h.slice(2) : h;
  if (!/^[0-9a-f]+$/.test(body)) throw new Error("INVALID_HEX");
  return BigInt("0x" + body);
}
