import crypto from "crypto";

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomApiKey(prefix = "vs") {
  const raw = crypto.randomBytes(32).toString("base64url");
  const key = `${prefix}_${raw}`;
  return key;
}

export function last4(key: string) {
  return key.slice(-4);
}
