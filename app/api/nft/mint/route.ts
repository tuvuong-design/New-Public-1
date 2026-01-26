import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getActiveMembershipTier } from "@/lib/membership";
import { getSiteConfig } from "@/lib/siteConfig";
import { releaseMaturedHolds } from "@/lib/stars/holds";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = getActiveMembershipTier((session.user as any) ?? {} as any);
  if (tier !== "PREMIUM_PLUS") {
    return Response.json({ error: "Premium+ required" }, { status: 403 });
  }

  const form = await req.formData();
  const videoId = String(form.get("videoId") || "");
  if (!videoId) {
    return Response.json({ error: "Missing videoId" }, { status: 400 });
  }

  const cfg = await getSiteConfig();
  const itemFee = (cfg as any).nftItemMintFeeStars ?? 10;
  const collectionFee = (cfg as any).nftCollectionMintFeeStars ?? 50;
  const treasuryUserId = (cfg as any).treasuryUserId as string | null | undefined;
  // Opportunistically release matured holds so mint fee check uses up-to-date balance.
  await releaseMaturedHolds(userId).catch(() => null);


  const [me, video, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, starBalance: true } }),
    prisma.video.findUnique({ where: { id: videoId }, select: { id: true, authorId: true, title: true, description: true, thumbKey: true, status: true } }),
    prisma.nftItem.findUnique({ where: { videoId } }),
  ]);

  // Find or create a default collection for this user.
  const collection = await prisma.nftCollection.findFirst({
    where: { creatorId: userId },
    orderBy: { createdAt: "asc" },
  });

  if (!me) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  if (!video || video.authorId !== userId) {
    return Response.json({ error: "Video not found" }, { status: 404 });
  }
  if (video.status !== "PUBLISHED") {
    return Response.json({ error: "Video must be PUBLISHED" }, { status: 400 });
  }
  if (existing) {
    return Response.json({ error: "Video already minted" }, { status: 409 });
  }
  // If user has no collection yet, they'll also pay the collection fee.
  const needsCollection = !collection;
  const totalFee = Number(itemFee) + (needsCollection ? Number(collectionFee) : 0);
  if (me.starBalance < totalFee) {
    return Response.json({ error: "Not enough stars" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const col = collection
      ? collection
      : await tx.nftCollection.create({
          data: {
            creatorId: userId,
            title: `${me.name || "User"}'s NFTs`,
            description: "Internal NFTs minted from videos",
            royaltyBps: (cfg as any).nftDefaultRoyaltyBps ?? 500,
            creatorRoyaltySharePct: 50,
          },
        });

    await tx.nftItem.create({
      data: {
        collectionId: col.id,
        ownerId: userId,
        videoId: video.id,
        name: video.title,
        description: video.description || "",
        imageKey: video.thumbKey,
      },
    });

    await tx.user.update({ where: { id: userId }, data: { starBalance: { decrement: totalFee } } });

    await tx.starTransaction.create({
      data: {
        userId,
        type: "NFT_MINT",
        delta: -totalFee,
        stars: totalFee,
        quantity: 1,
        videoId: video.id,
        note: needsCollection
          ? `Mint NFT + create collection from video ${video.id}`
          : `Mint NFT from video ${video.id}`,
      },
    });

    // Fees go to treasury/admin user (if configured).
    if (treasuryUserId) {
      await tx.user.update({ where: { id: treasuryUserId }, data: { starBalance: { increment: totalFee } } }).catch(() => null);
      await tx.starTransaction.create({
        data: {
          userId: treasuryUserId,
          type: "ADMIN_GRANT",
          delta: totalFee,
          stars: totalFee,
          quantity: 1,
          videoId: video.id,
          note: `Treasury: receive NFT mint fee from user ${userId}`,
        },
      }).catch(() => null);
    }
  });

  redirect(`/u/${userId}/nfts`);
}
