import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { verifyUserPin } from "@/lib/security/pin";

export const runtime = "nodejs";

const patchSchema = z.object({
  priceStars: z.number().int().min(1).max(1_000_000_000),
  pin: z.string().min(4).max(12).regex(/^\d+$/).optional(),
});

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["NFT_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

/**
 * Chỉnh sửa listing (ví dụ: đổi giá). Quy tắc bảo mật:
 * - Bắt buộc scope NFT_WRITE (strict)
 * - Bắt buộc JWT (user login)
 * - Chỉ seller mới được sửa
 * - Chỉ sửa khi listing đang ACTIVE
 * - Nếu user đã set PIN thì bắt buộc gửi pin
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardExternal(req, { scopes: ["NFT_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;

  const userId = g.user!.sub;
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return withCors(jsonError(400, "Dữ liệu không hợp lệ", body.error.flatten()), g.origin);

  // PIN bảo mật (nếu user đã set)
  const pinRec = await prisma.userPin.findUnique({ where: { userId } });
  if (pinRec) {
    const pin = (body.data.pin || "").trim();
    if (!pin) return withCors(jsonError(400, "Thiếu mã PIN"), g.origin);
    const vr = await verifyUserPin(userId, pin);
    if (!vr.ok) return withCors(jsonError(403, vr.reason === "LOCKED" ? "PIN đang bị khoá tạm thời" : "PIN sai", vr), g.origin);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const listing = await tx.nftListing.findUnique({ where: { id: params.id } });
      if (!listing) throw new Error("LISTING_NOT_FOUND");
      if (listing.status !== "ACTIVE") throw new Error("LISTING_NOT_ACTIVE");
      if (listing.sellerId !== userId) throw new Error("NOT_SELLER");

      return tx.nftListing.update({
        where: { id: listing.id },
        data: {
          priceStars: body.data.priceStars,
          updatedAt: new Date(),
        },
      });
    });

    return withCors(NextResponse.json({ ok: true, listing: updated }), g.origin);
  } catch (e: any) {
    return withCors(jsonError(400, e?.message ?? "UPDATE_FAILED"), g.origin);
  }
}
