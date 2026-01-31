import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "../_shared";
import { withCors } from "@/lib/api/cors";
import { verifyApiKey } from "@/lib/api/apiKey";
import { jsonError } from "@/lib/api/errors";

export async function OPTIONS(req: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), req.headers.get("origin") ?? undefined);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") ?? undefined;
  const apiKey = await verifyApiKey(req);
  if (!apiKey.ok && origin) return withCors(jsonError(401, "Missing or invalid API key"), origin);

  clearAuthCookies();
  const res = NextResponse.json({ ok: true });
  return withCors(res, origin);
}
