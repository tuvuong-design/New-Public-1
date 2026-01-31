/**
 * Template route external (App Router)
 * - Bắt API key + strictScopes
 * - Bắt JWT (cookie/bearer) nếu cần
 * - Zod validate input
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/external/requireApiKey";
import { requireJwtUser } from "@/lib/api/external/requireJwtUser";

const Body = z.object({
  example: z.string().min(1),
});

export async function POST(req: Request) {
  const apiKey = await requireApiKey(req, { strictScopes: true, requireScopes: ["USER_WRITE"] });
  const user = await requireJwtUser(req);

  const json = await req.json().catch(() => ({}));
  const body = Body.parse(json);

  return NextResponse.json({ ok: true, apiKeyId: apiKey.id, userId: user.id, body });
}
