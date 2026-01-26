import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

function toInt(v: FormDataEntryValue | null, def = 0) {
  const n = Number(v ?? def);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

function addHours(d: Date, hours: number) {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData();
  const itemId = String(form.get("itemId") || "").trim();
  const back = String(form.get("back") || req.headers.get("referer") || (itemId ? `/nft/items/${itemId}` : "/nft/market"));

  const startPriceStars = Math.max(1, toInt(form.get("startPriceStars"), 1));
  const reserveRaw = form.get("reservePriceStars");
  const reservePriceStars = reserveRaw ? Math.max(0, toInt(reserveRaw, 0)) : null;

  const durationHours = Math.max(1, Math.min(168, toInt(form.get("durationHours"), 24)));
  if (!itemId) return Response.json({ error: "ITEM_ID_REQUIRED" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    const item = await tx.nftItem.findUnique({
      where: { id: itemId },
      include: {
        listings: { where: { status: "ACTIVE" }, take: 1 },
        auctions: { where: { status: "ACTIVE" }, take: 1 },
      },
    });

    if (!item) throw new Error("ITEM_NOT_FOUND");
    if (item.ownerId !== userId) throw new Error("FORBIDDEN");
    if (item.marketplaceFrozen || item.exportStatus !== "NONE") throw new Error("MARKETPLACE_FROZEN");
    if (item.listings.length) throw new Error("HAS_ACTIVE_LISTING");
    if (item.auctions.length) throw new Error("HAS_ACTIVE_AUCTION");

    const endAt = addHours(new Date(), durationHours);

    await tx.nftAuction.create({
      data: {
        itemId,
        sellerId: userId,
        startPriceStars,
        reservePriceStars: reservePriceStars && reservePriceStars > 0 ? reservePriceStars : null,
        endAt,
      },
    });
  });

  redirect(back);
}
