import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";
import { queues } from "@/lib/queues";

export const runtime = "nodejs";

function clampInt(n: number, min: number, max: number, def: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, v));
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const clipId = ctx.params.id;
  const clip = await prisma.clip.findUnique({
    where: { id: clipId },
    include: { video: { select: { id: true, title: true, authorId: true } } },
  });
  if (!clip) return Response.json({ ok: false, message: "NOT_FOUND" }, { status: 404 });
  if (clip.creatorId !== userId && (session?.user as any)?.role !== "ADMIN") return Response.json({ ok: false, message: "FORBIDDEN" }, { status: 403 });
  if (!clip.outputKey || String(clip.status) !== "READY") {
    return Response.json({ ok: false, message: "CLIP_NOT_READY" }, { status: 400 });
  }

  const cfg = await getSiteConfig();
  const mode = String((cfg as any).clipNftMarketplaceMode ?? "SEPARATE_ONLY");
  const onChainEnabled = Boolean((cfg as any).clipNftOnChainMintEnabled);

  const form = await req.formData().catch(() => null);
  const priceStars = clampInt(Number(form?.get("priceStars") ?? 0), 0, 1_000_000, 0);
  const listNow = String(form?.get("listNow") ?? "") === "on";
  const editionSize = clampInt(Number(form?.get("editionSize") ?? 1), 1, 100, 1);

  const maxRoyalty = clampInt((cfg as any).nftMaxRoyaltyBps ?? 1000, 0, 10_000, 1000);
  const defRoyalty = clampInt((cfg as any).nftDefaultRoyaltyBps ?? 500, 0, maxRoyalty, 500);
  const royaltyBps = clampInt(Number(form?.get("royaltyBps") ?? defRoyalty), 0, maxRoyalty, defRoyalty);

  const out = await prisma.$transaction(async (tx) => {
    let nftItemId: string | null = null;

    if (mode === "MARKETPLACE_ONLY" || mode === "BOTH") {
      // Ensure a collection
      let col = await tx.nftCollection.findFirst({ where: { ownerId: userId, title: "Clip Highlights" } });
      if (!col) {
        col = await tx.nftCollection.create({
          data: {
            ownerId: userId,
            title: "Clip Highlights",
            description: "Auto-generated from clips",
            coverImageKey: null,
            chain: "SOLANA" as any,
            metadataStrategy: "INTERNAL" as any,
          } as any,
        });
      }

      // Upsert item by clipId (idempotent)
      const existing = await tx.nftItem.findFirst({ where: { clipId: clip.id, ownerId: userId } });
      const item = existing
        ? await tx.nftItem.update({
            where: { id: existing.id },
            data: {
              title: clip.title ?? `Clip ${clip.id}`,
              description: `Clip from video: ${clip.video.title}`,
              imageKey: clip.outputKey,
            } as any,
          })
        : await tx.nftItem.create({
            data: {
              collectionId: col.id,
              ownerId: userId,
              title: clip.title ?? `Clip ${clip.id}`,
              description: `Clip from video: ${clip.video.title}`,
              imageKey: clip.outputKey,
              chain: "SOLANA" as any,
              metadataStrategy: "INTERNAL" as any,
              clipId: clip.id,
            } as any,
          });

      nftItemId = item.id;

      // Listing
      const existingListing = await tx.nftListing.findFirst({ where: { itemId: item.id, sellerId: userId, status: "ACTIVE" as any } });
      if (listNow && priceStars > 0) {
        if (existingListing) {
          await tx.nftListing.update({ where: { id: existingListing.id }, data: { priceStars } as any });
        } else {
          await tx.nftListing.create({ data: { itemId: item.id, sellerId: userId, priceStars, status: "ACTIVE" as any } as any });
        }
      } else {
        // If user unchecked listNow or priceStars=0, deactivate existing active listing
        if (existingListing) {
          await tx.nftListing.update({ where: { id: existingListing.id }, data: { status: "INACTIVE" as any } as any });
        }
      }
    }

    let clipNftId: string | null = null;
    if (mode === "SEPARATE_ONLY" || mode === "BOTH") {
      const existing = await tx.clipNft.findUnique({ where: { clipId: clip.id } });
      const updated = existing
        ? await tx.clipNft.update({
            where: { id: existing.id },
            data: {
              nftItemId,
              editionSize,
              royaltyBps,
              // Allow re-trying FAILED by setting back to PENDING; never reset minted.
              status: existing.status === ("FAILED" as any) ? ("PENDING" as any) : existing.status,
            },
          })
        : await tx.clipNft.create({
            data: { clipId: clip.id, chain: "SOLANA" as any, status: "PENDING" as any, nftItemId, editionSize, royaltyBps },
          });
      clipNftId = updated.id;
    }

    return { mode, nftItemId, listNow, priceStars, clipNftId, onChainEnabled };
  });

  // Enqueue on-chain mint (Option 1) if enabled and separate tracking exists
  if ((mode === "SEPARATE_ONLY" || mode === "BOTH") && onChainEnabled) {
    await queues.nft.add(
      "clip_mint_nft",
      { clipId },
      { jobId: `clip_mint_nft:${clipId}`, removeOnComplete: true, removeOnFail: 1000 }
    );
  }

  return Response.redirect(new URL("/studio/clips", req.url), 303);
}
