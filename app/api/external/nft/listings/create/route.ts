import { NextRequest, NextResponse } from "next/server";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { verifyUserPin } from "@/lib/security/pin";

export const runtime = "nodejs";

const schema = z.object({
  itemId: z.string().min(1),
  priceStars: z.number().int().min(1).max(1_000_000_000),
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

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return withCors(jsonError(400, "Invalid input", parsed.error.flatten()), g.origin);

  const userId = g.user!.sub;

  // PIN bảo mật (nếu user đã set)
  const pinRec = await prisma.userPin.findUnique({ where: { userId } });
  if (pinRec) {
    const pin = (parsed.data.pin || "").trim();
    if (!pin) return withCors(jsonError(400, "Thiếu mã PIN"), g.origin);
    const vr = await verifyUserPin(userId, pin);
    if (!vr.ok) return withCors(jsonError(403, vr.reason === "LOCKED" ? "PIN đang bị khoá tạm thời" : "PIN sai", vr), g.origin);
  }


  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.nftItem.findUnique({
        where: { id: parsed.data.itemId },
        select: { id: true, ownerId: true, marketplaceFrozen: true, exportStatus: true },
      });
      if (!item) throw new Error("NFT_NOT_FOUND");
      if (item.ownerId !== userId) throw new Error("NOT_OWNER");
      if (item.marketplaceFrozen || item.exportStatus !== "NONE") throw new Error("MARKETPLACE_FROZEN");

      const activeListing = await tx.nftListing.findFirst({ where: { itemId: item.id, status: "ACTIVE" }, select: { id: true } });
      if (activeListing) throw new Error("ALREADY_LISTED");

      const activeAuction = await tx.nftAuction.findFirst({ where: { itemId: item.id, status: "ACTIVE" }, select: { id: true } });
      if (activeAuction) throw new Error("ALREADY_IN_AUCTION");

      const listing = await tx.nftListing.create({
        data: { itemId: item.id, sellerId: userId, priceStars: parsed.data.priceStars, status: "ACTIVE" },
      });

      return listing;
    });

    return withCors(NextResponse.json({ ok: true }), g.origin);
  } catch (e: any) {
    return withCors(jsonError(400, e?.message ?? "CREATE_LISTING_FAILED"), g.origin);
  }
}
