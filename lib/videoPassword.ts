import crypto from "crypto";
import { compare, hash } from "bcryptjs";
import { env, requireEnv } from "@/lib/env";

/**
 * Password gate for videos.
 *
 * - Password is stored as bcrypt hash on Video.accessPasswordHash.
 * - After successful unlock, we set a signed cookie scoped to `/v/:id`.
 */

const COOKIE_NAME = "videoshare_vpw";
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function hashVideoPassword(plain: string) {
  return hash(plain, 10);
}

export async function verifyVideoPassword(plain: string, passwordHash: string) {
  return compare(plain, passwordHash);
}

export function getVideoPasswordCookieName() {
  return COOKIE_NAME;
}

function hmac(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * Token format: v1.<videoId>.<expEpochSec>.<sig>
 */
export function signVideoPasswordToken(videoId: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const secret = env.AUTH_SECRET ?? "";
  if (!secret) {
    // In production we require AUTH_SECRET, but during install wizard env might be missing.
    // Fallback to throw in runtime to avoid insecure gating.
    requireEnv();
  }
  const body = `v1.${videoId}.${exp}`;
  const sig = hmac(env.AUTH_SECRET as string, body);
  return `${body}.${sig}`;
}

export function verifyVideoPasswordToken(token: string, videoId: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 4) return false;
    const [v, vid, expStr, sig] = parts;
    if (v !== "v1") return false;
    if (vid !== videoId) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp <= 0) return false;
    if (Math.floor(Date.now() / 1000) > exp) return false;
    const secret = env.AUTH_SECRET ?? "";
    if (!secret) return false;
    const body = `v1.${videoId}.${exp}`;
    const expected = hmac(secret, body);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}
