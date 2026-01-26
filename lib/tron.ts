import { sha256 } from "@noble/hashes/sha256";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_MAP: Record<string, number> = Object.create(null);
for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP[ALPHABET[i]] = i;

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.length % 2 === 0 ? hex : "0" + hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  // Convert to base58
  const digits: number[] = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      const x = digits[j] * 256 + carry;
      digits[j] = x % 58;
      carry = Math.floor(x / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let s = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) s += ALPHABET[digits[i]];
  return s;
}

function base58Decode(str: string): Uint8Array {
  const s = String(str || "").trim();
  if (!s) return new Uint8Array();

  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;

  const bytes: number[] = [];
  for (let i = zeros; i < s.length; i++) {
    const ch = s[i];
    const val = ALPHABET_MAP[ch];
    if (val === undefined) throw new Error("INVALID_BASE58");
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      const x = bytes[j] * 58 + carry;
      bytes[j] = x & 0xff;
      carry = x >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < zeros; i++) out[i] = 0;
  for (let i = 0; i < bytes.length; i++) out[out.length - 1 - i] = bytes[i];
  return out;
}

function checksum(payload: Uint8Array): Uint8Array {
  const h1 = sha256(payload);
  const h2 = sha256(h1);
  return h2.slice(0, 4);
}

/**
 * Decode TRON Base58Check address (T...) into 21-byte payload (0x41 + 20 bytes).
 */
export function base58CheckDecode(addr: string): Uint8Array {
  const raw = base58Decode(addr);
  if (raw.length < 5) throw new Error("TRON_ADDR_TOO_SHORT");
  const payload = raw.slice(0, raw.length - 4);
  const c = raw.slice(raw.length - 4);
  const exp = checksum(payload);
  for (let i = 0; i < 4; i++) if (c[i] !== exp[i]) throw new Error("TRON_ADDR_BAD_CHECKSUM");
  return payload;
}

/**
 * Encode 21-byte payload (0x41 + 20 bytes) into TRON Base58Check (T...).
 */
export function base58CheckEncode(payload: Uint8Array): string {
  if (payload.length !== 21) throw new Error("TRON_PAYLOAD_LEN");
  const c = checksum(payload);
  const all = new Uint8Array(payload.length + c.length);
  all.set(payload, 0);
  all.set(c, payload.length);
  return base58Encode(all);
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

/**
 * Convert TRON hex41 (41...) to base58 (T...).
 */
export function tronHex41ToBase58(hex41: string): string {
  const h = normalizeTronAddressToHex41(hex41);
  return base58CheckEncode(hexToBytes(h));
}
