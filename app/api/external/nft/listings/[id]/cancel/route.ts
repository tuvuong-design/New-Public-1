import { NextRequest, NextResponse } from "next/server";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { verifyUserPin } from "@/lib/security/pin";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  pin: z.string().min(4).max(12).regex(/^\d+$/).optional(),
});


export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["NFT_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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


  try {
    await prisma.$transaction(async (tx) => {
      const listing = await tx.nftListing.findUnique({ where: { id: params.id } });
      if (!listing) throw new Error("LISTING_NOT_FOUND");
      if (listing.status !== "ACTIVE") throw new Error("LISTING_NOT_ACTIVE");
      if (listing.sellerId !== userId) throw new Error("NOT_SELLER");

      const updated = await tx.nftListing.updateMany({
        where: { id: listing.id, status: "ACTIVE" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (updated.count !== 1) throw new Error("RACE_CANCEL");
    });

    return withCors(NextResponse.json({ ok: true }), g.origin);
  } catch (e: any) {
    return withCors(jsonError(400, e?.message ?? "CANCEL_FAILED"), g.origin);
  }
}
