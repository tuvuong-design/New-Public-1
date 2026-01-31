import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, signAccessToken, signRefreshToken } from "@/lib/api/jwt";
import { jsonError } from "@/lib/api/errors";
import { setAuthCookies, REFRESH_COOKIE } from "../_shared";
import { withCors } from "@/lib/api/cors";

export async function OPTIONS(req: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), req.headers.get("origin") ?? undefined);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") ?? undefined;
  const refresh = cookies().get(REFRESH_COOKIE)?.value;
  if (!refresh) return withCors(jsonError(401, "Missing refresh token"), origin);

  const payload = await verifyToken(refresh).catch(() => null);
  if (!payload || payload.typ !== "refresh") return withCors(jsonError(401, "Invalid refresh token"), origin);

  const userPayload = { sub: String(payload.sub), email: (payload.email as string) ?? null, role: String(payload.role) };
  const access = await signAccessToken(userPayload, "15m");
  const newRefresh = await signRefreshToken(userPayload, "30d");
  setAuthCookies(access, newRefresh);

  const res = NextResponse.json({ ok: true });
  return withCors(res, origin);
}
