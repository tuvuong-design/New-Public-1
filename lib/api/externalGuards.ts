import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { verifyApiKey, hasScope, hasScopeStrict, type ApiKeyScope } from "@/lib/api/apiKey";
import { withCors } from "@/lib/api/cors";
import { getJwtUser } from "@/lib/api/externalAuth";

export type GuardResult = {
  ok: true;
  origin?: string;
  apiKey: any;
  user: any | null;
} | {
  ok: false;
  res: NextResponse;
};

/**
 * Guard chuẩn cho các endpoint /api/external/*:
 * - Bắt buộc X-API-Key (để xác định frontend/app nào gọi)
 * - Nếu có Origin: kiểm tra allowlist theo api key
 * - (Tuỳ chọn) yêu cầu scope
 * - (Tuỳ chọn) yêu cầu login (JWT cookie/bearer)
 */
export async function guardExternal(req: NextRequest, opts?: { scopes?: ApiKeyScope | ApiKeyScope[]; requireAuth?: boolean; strictScopes?: boolean }) : Promise<GuardResult> {
  const origin = req.headers.get("origin") ?? undefined;

  const apiKeyRes = await verifyApiKey(req);
  if (!apiKeyRes.ok) {
    const res = withCors(jsonError(401, "Missing or invalid API key", apiKeyRes), origin);
    return { ok: false, res };
  }

  if (opts?.scopes) {
    const okScope = opts.strictScopes
      ? hasScopeStrict(apiKeyRes.apiKey.scopes, opts.scopes)
      : hasScope(apiKeyRes.apiKey.scopes, opts.scopes);
    if (!okScope) {
      const res = withCors(jsonError(403, "API key does not have required scope"), origin);
      return { ok: false, res };
    }
  }

  const user = await getJwtUser(req);
  if (opts?.requireAuth && !user) {
    const res = withCors(jsonError(401, "Unauthorized (missing/invalid JWT)"), origin);
    return { ok: false, res };
  }

  return { ok: true, origin: apiKeyRes.origin || origin, apiKey: apiKeyRes.apiKey, user };
}
