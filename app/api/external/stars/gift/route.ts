import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { releaseMaturedHoldsTx } from "@/lib/stars/holds";
import { applyReferralBonusTx } from "@/lib/referrals";
import { verifyUserPin } from "@/lib/security/pin";

export const runtime = "nodejs";

const schema = z.object({
  toUserId: z.string().min(1),
  stars: z.number().int().min(1).max(9999),
  message: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
  pin: z.string().min(4).max(12).regex(/^\d+$/).optional(),
});

function idemFrom(req: NextRequest, bodyIdem?: string) {
  const h = req.headers.get("Idempotency-Key") || req.headers.get("x-idempotency-key");
  const raw = (bodyIdem || h || "").trim();
  if (raw) return raw.slice(0, 128);
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["USER_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function POST(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["USER_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;

  const fromUserId = g.user!.sub;
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return withCors(jsonError(400, "Dữ liệu không hợp lệ", body.error.flatten()), g.origin);
  if (body.data.toUserId === fromUserId) return withCors(jsonError(400, "Không thể tự tặng sao cho chính mình"), g.origin);

  // PIN bảo mật (nếu user đã set PIN)
  const pinRec = await prisma.userPin.findUnique({ where: { userId: fromUserId } });
  if (pinRec) {
    const pin = (body.data.pin || "").trim();
    if (!pin) return withCors(jsonError(400, "Thiếu mã PIN"), g.origin);
    const vr = await verifyUserPin(fromUserId, pin);
    if (!vr.ok) return withCors(jsonError(403, vr.reason === "LOCKED" ? "PIN đang bị khoá tạm thời" : "PIN sai", vr), g.origin);
  }

  const idempotencyKey = idemFrom(req, body.data.idempotencyKey);
  const msg = (body.data.message ?? "").trim().slice(0, 500);

  try {
    const out = await prisma.$transaction(async (tx) => {
      const existing = await tx.creatorTip.findFirst({
        where: { fromUserId, idempotencyKey },
        select: { id: true, stars: true, toUserId: true },
      });
      if (existing) return { existing: true as const, tipId: existing.id, stars: existing.stars, toUserId: existing.toUserId };

      await releaseMaturedHoldsTx(tx as any, fromUserId);

      const [from, to] = await Promise.all([
        tx.user.findUnique({ where: { id: fromUserId }, select: { id: true, starBalance: true, name: true } }),
        tx.user.findUnique({ where: { id: body.data.toUserId }, select: { id: true, starBalance: true, name: true } }),
      ]);
      if (!from || !to) throw new Error("USER_NOT_FOUND");
      if (from.starBalance < body.data.stars) throw new Error("INSUFFICIENT_STARS");

      await tx.user.update({ where: { id: fromUserId }, data: { starBalance: { decrement: body.data.stars } } });
      await tx.user.update({ where: { id: body.data.toUserId }, data: { starBalance: { increment: body.data.stars } } });

      const senderTx = await tx.starTransaction.create({
        data: {
          userId: fromUserId,
          delta: -body.data.stars,
          stars: body.data.stars,
          quantity: 1,
          type: "CREATOR_TIP",
          note: JSON.stringify({ v: 1, kind: "CREATOR_TIP", toUserId: body.data.toUserId, message: msg }),
        },
        select: { id: true },
      });

      await tx.starTransaction.create({
        data: {
          userId: body.data.toUserId,
          delta: body.data.stars,
          stars: body.data.stars,
          quantity: 1,
          type: "CREATOR_TIP",
          note: JSON.stringify({ v: 1, kind: "CREATOR_TIP_IN", fromUserId, message: msg }),
        },
        select: { id: true },
      });

      await applyReferralBonusTx(tx as any, {
        referredUserId: body.data.toUserId,
        baseStars: body.data.stars,
        sourceKind: "EARN",
        sourceId: senderTx.id,
        baseStarTxId: senderTx.id,
      });

      const tip = await tx.creatorTip.create({
        data: {
          fromUserId,
          toUserId: body.data.toUserId,
          stars: body.data.stars,
          message: msg || null,
          starTxId: senderTx.id,
          idempotencyKey,
        },
        select: { id: true },
      });

      return { existing: false as const, tipId: tip.id, stars: body.data.stars, toUserId: body.data.toUserId };
    });

    return withCors(NextResponse.json({ ok: true, ...out }), g.origin);
  } catch (e: any) {
    const m = String(e?.message || "UNKNOWN");
    if (m === "INSUFFICIENT_STARS") return withCors(jsonError(400, "Không đủ sao"), g.origin);
    if (m === "USER_NOT_FOUND") return withCors(jsonError(404, "User không tồn tại"), g.origin);
    return withCors(jsonError(500, "Lỗi server", { message: m }), g.origin);
  }
}
