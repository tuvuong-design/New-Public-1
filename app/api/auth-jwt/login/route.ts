import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { signAccessToken, signRefreshToken } from "@/lib/api/jwt";
import { jsonError } from "@/lib/api/errors";
import { setAuthCookies } from "../_shared";
import { rateLimit, ipKey } from "@/lib/api/rateLimit";
import { verifyApiKey } from "@/lib/api/apiKey";
import { withCors } from "@/lib/api/cors";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  // Nếu true: API sẽ trả accessToken/refreshToken trong JSON (hữu ích cho app mobile).
  returnTokens: z.boolean().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), req.headers.get("origin") ?? undefined);
}

export async function POST(req: NextRequest) {
  // API key required for cross-origin browser apps; native apps can omit origin but should send x-api-key anyway.
  const origin = req.headers.get("origin") ?? undefined;
  const apiKey = await verifyApiKey(req);
  if (!apiKey.ok && origin) return withCors(jsonError(401, "Missing or invalid API key"), origin);

  const rl = await rateLimit(req, { key: `rl:login:${ipKey(req)}`, limit: 20, windowSec: 60 });
  if (!rl.ok) return withCors(jsonError(429, "Too many attempts. Please try again later."), origin);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return withCors(jsonError(400, "Invalid input", parsed.error.flatten()), origin);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash) return withCors(jsonError(401, "Invalid credentials"), origin);

  const ok = await compare(parsed.data.password, user.passwordHash);
  if (!ok) return withCors(jsonError(401, "Invalid credentials"), origin);

  const payload = { sub: user.id, email: user.email ?? null, role: user.role };
  const access = await signAccessToken(payload, "15m");
  const refresh = await signRefreshToken(payload, "30d");

  setAuthCookies(access, refresh);

  const wantsTokens = parsed.data.returnTokens === true || req.headers.get("x-return-tokens") === "1";
  const body: any = { ok: true, user: { id: user.id, email: user.email, role: user.role, name: user.name } };
  if (wantsTokens) {
    body.accessToken = access;
    body.refreshToken = refresh;
    body.tokenType = "Bearer";
    body.expiresInSec = 60 * 15;
  }

  const res = NextResponse.json(body);
  return withCors(res, origin);
}
