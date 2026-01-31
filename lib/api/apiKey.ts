import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256 } from "./crypto";

export type ApiKeyScope =
  | "PUBLIC_READ"
  | "VIDEO_READ"
  | "VIDEO_WRITE"
  | "COMMENT_READ"
  | "COMMENT_WRITE"
  | "LIKE_WRITE"
  | "VIEW_WRITE"
  | "NFT_READ"
  | "NFT_WRITE"
  | "USER_READ"
  | "USER_WRITE"
  | "AUTH"
  | "ADMIN";

// Nếu scopes trống/undefined: mặc định cho phép (để không làm gãy key cũ).
// Với các scope nhạy cảm (WRITE/ADMIN), bạn có thể dùng hasScopeStrict để bắt buộc phải khai báo.
export function hasScope(scopes: unknown, required: ApiKeyScope | ApiKeyScope[]) {
  const reqs = Array.isArray(required) ? required : [required];
  const arr = Array.isArray(scopes) ? (scopes as string[]) : [];
  if (arr.length === 0) return true;
  return reqs.every((r) => arr.includes(r));
}

export async function verifyApiKey(req: NextRequest) {
  const key = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
  if (!key) return { ok: false as const, reason: "missing" as const };

  const hash = sha256(key);
  const rec = await prisma.apiKey.findFirst({
    where: { keyHash: hash, revokedAt: null, isActive: true },
  });

  if (!rec) return { ok: false as const, reason: "invalid" as const };

  const origin = req.headers.get("origin") || "";
  const allowed = (rec.allowedOrigins as unknown as string[]) || [];
  const originOk = !origin || allowed.length === 0 || allowed.includes(origin);

  if (!originOk) return { ok: false as const, reason: "origin_not_allowed" as const };

  return { ok: true as const, apiKey: rec, origin };
}


// Bắt buộc API key phải có scopes và phải chứa tất cả scope yêu cầu.
// Dùng cho các action nhạy cảm như VIEW_WRITE / NFT_WRITE / COMMENT_WRITE...
export function hasScopeStrict(scopes: unknown, required: ApiKeyScope | ApiKeyScope[]) {
  const reqs = Array.isArray(required) ? required : [required];
  const arr = Array.isArray(scopes) ? (scopes as string[]) : [];
  if (arr.length === 0) return false;
  return reqs.every((r) => arr.includes(r));
}
