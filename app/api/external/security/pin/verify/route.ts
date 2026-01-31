import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { verifyUserPin } from "@/lib/security/pin";

export const runtime = "nodejs";

const schema = z.object({
  pin: z.string().min(4).max(12).regex(/^\d+$/, "PIN chỉ gồm số"),
});

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["USER_READ","AUTH"], requireAuth: true });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function POST(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["USER_READ"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;

  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return withCors(jsonError(400, "Dữ liệu không hợp lệ", body.error.flatten()), g.origin);

  const r = await verifyUserPin(g.user!.id, body.data.pin);
  if (!r.ok) return withCors(jsonError(403, r.reason === "LOCKED" ? "PIN đang bị khoá tạm thời" : "PIN sai", r), g.origin);

  return withCors(NextResponse.json({ ok: true }), g.origin);
}
