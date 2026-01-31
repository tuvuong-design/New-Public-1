import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { verifyUserPin } from "@/lib/security/pin";

export const runtime = "nodejs";

const schema = z.object({
  clipId: z.string().min(1),
  chain: z.enum(["SOLANA","ETHEREUM","POLYGON","BSC","BASE","TRON"]).default("SOLANA"),
  editionSize: z.number().int().min(1).max(100).default(1),
  pin: z.string().min(4).max(12).regex(/^\d+$/).optional(),
});

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["NFT_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function POST(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["NFT_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;

  const userId = g.user!.sub;
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return withCors(jsonError(400, "Dữ liệu không hợp lệ", body.error.flatten()), g.origin);

  // PIN bảo mật (nếu user đã set)
  const pinRec = await prisma.userPin.findUnique({ where: { userId } });
  if (pinRec) {
    const pin = (body.data.pin || "").trim();
    if (!pin) return withCors(jsonError(400, "Thiếu mã PIN"), g.origin);
    const vr = await verifyUserPin(userId, pin);
    if (!vr.ok) return withCors(jsonError(403, vr.reason === "LOCKED" ? "PIN đang bị khoá tạm thời" : "PIN sai", vr), g.origin);
  }

  const clip = await prisma.clip.findUnique({ where: { id: body.data.clipId }, select: { id: true, creatorId: true } });
  if (!clip) return withCors(jsonError(404, "Không tìm thấy clip"), g.origin);
  if (clip.creatorId !== userId) return withCors(jsonError(403, "Chỉ chủ clip mới được đúc NFT"), g.origin);

  // Tạo yêu cầu mint (worker sẽ xử lý nếu bạn đã bật on-chain mint)
  const existing = await prisma.clipNft.findUnique({ where: { clipId: clip.id } });
  if (existing) {
    return withCors(NextResponse.json({ ok: true, clipNftId: existing.id, status: existing.status }), g.origin);
  }

  const created = await prisma.clipNft.create({
    data: {
      clipId: clip.id,
      chain: body.data.chain as any,
      editionSize: body.data.editionSize,
      status: "PENDING",
    },
    select: { id: true, status: true, chain: true, editionSize: true, createdAt: true },
  });

  return withCors(NextResponse.json({ ok: true, clipNft: created }), g.origin);
}
