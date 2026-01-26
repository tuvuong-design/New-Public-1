import { sha256 } from "@noble/hashes/sha256";

// Minimal Base58Check decode (used for TRON addresses).
// TRON base58 address encodes: payload (21 bytes) + checksum (4 bytes)
// where checksum = first4(sha256(sha256(payload))).

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58ToBytes(s: string): Uint8Array {
  let num = 0n;
  for (const ch of s) {
    const p = ALPHABET.indexOf(ch);
    if (p < 0) throw new Error("BASE58_INVALID_CHAR");
    num = num * 58n + BigInt(p);
  }

  // Convert bigint to bytes
  let hex = num.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let bytes = hex ? Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))) : new Uint8Array();

  // Handle leading zeros
  let leading = 0;
  for (const ch of s) {
    if (ch === "1") leading++;
    else break;
  }
  if (leading > 0) {
    const out = new Uint8Array(leading + bytes.length);
    out.set(bytes, leading);
    bytes = out;
  }
  return bytes;
}

function checksum4(payload: Uint8Array): Uint8Array {
  const h1 = sha256(payload);
  const h2 = sha256(h1);
  return h2.slice(0, 4);
}

export function base58CheckDecode(input: string): Uint8Array {
  const raw = base58ToBytes(String(input || "").trim());
  if (raw.length < 5) throw new Error("BASE58CHECK_TOO_SHORT");
  const payload = raw.slice(0, raw.length - 4);
  const chk = raw.slice(raw.length - 4);
  const expected = checksum4(payload);
  for (let i = 0; i < 4; i++) {
    if (chk[i] !== expected[i]) throw new Error("BASE58CHECK_BAD_CHECKSUM");
  }
  return payload;
}
