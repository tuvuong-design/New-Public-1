import type { NextRequest } from "next/server";
import { verifyToken, type JwtUser } from "@/lib/api/jwt";
import { ACCESS_COOKIE } from "@/app/api/auth-jwt/_shared";

/**
 * Lấy JWT user từ request (ưu tiên Authorization Bearer, fallback sang cookie vs_access).
 * - Browser cross-domain: nên dùng cookie (credentials: include) hoặc Bearer token.
 * - Mobile/Expo: nên dùng Bearer token.
 */
export async function getJwtUser(req: NextRequest): Promise<JwtUser | null> {
  const authz = req.headers.get("authorization") || req.headers.get("Authorization");
  const bearer = authz?.startsWith("Bearer ") ? authz.slice("Bearer ".length).trim() : null;

  const cookieToken = req.cookies.get(ACCESS_COOKIE)?.value || null;
  const token = bearer || cookieToken;
  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    // payload: { sub, email, role, ... }
    if (!payload?.sub) return null;
    return payload as any as JwtUser;
  } catch {
    return null;
  }
}

/** Tạo object session kiểu NextAuth tối thiểu để reuse các hàm canViewVideoDb/canInteractWithVideoDb */
export function sessionFromJwt(u: JwtUser | null) {
  if (!u) return null;
  return { user: { id: u.sub, email: u.email, role: u.role } } as any;
}
