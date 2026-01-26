import crypto from "node:crypto";

function normalizeKey(raw: string): Buffer {
  const s = (raw || "").trim();
  if (!s) throw new Error("APP_ENCRYPTION_KEY_REQUIRED");

  // Accept: 64-hex, base64 (>=32 bytes), or raw passphrase (hashed).
  if (/^[a-fA-F0-9]{64}$/.test(s)) return Buffer.from(s, "hex");

  try {
    const b = Buffer.from(s, "base64");
    if (b.length >= 32) return b.subarray(0, 32);
  } catch {
    // ignore
  }

  // Fallback: hash the passphrase to 32 bytes.
  return crypto.createHash("sha256").update(s, "utf8").digest();
}

export function getEncryptionKey(): Buffer {
  return normalizeKey(process.env.APP_ENCRYPTION_KEY || "");
}

export function sealJson(obj: unknown): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function openJson<T>(sealed: string): T {
  const s = (sealed || "").trim();
  if (!s) throw new Error("SECRET_EMPTY");
  const parts = s.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("SECRET_FORMAT_INVALID");

  const key = getEncryptionKey();
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const data = Buffer.from(parts[3], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext) as T;
}
