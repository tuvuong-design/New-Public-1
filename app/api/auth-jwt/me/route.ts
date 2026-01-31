import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/api/jwt";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api/errors";
import { ACCESS_COOKIE } from "../_shared";
import { withCors } from "@/lib/api/cors";
import { verifyApiKey } from "@/lib/api/apiKey";

export async function OPTIONS(req: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), req.headers.get("origin") ?? undefined);
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin") ?? undefined;
  // API key bắt buộc khi gọi từ trình duyệt khác domain (có Origin header)
  const apiKey = await verifyApiKey(req);
  if (!apiKey.ok && origin) return withCors(jsonError(401, "Missing or invalid API key"), origin);

  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const access = bearer || cookies().get(ACCESS_COOKIE)?.value;
  if (!access) return withCors(jsonError(401, "Not logged in"), origin);

  const payload = await verifyToken(access).catch(() => null);
  if (!payload?.sub) return withCors(jsonError(401, "Invalid token"), origin);

  const user = await prisma.user.findUnique({ where: { id: String(payload.sub) }, select: { id: true, email: true, role: true, name: true, image: true } });
  if (!user) return withCors(jsonError(401, "User not found"), origin);

  const res = NextResponse.json({ ok: true, user });
  return withCors(res, origin);
}
