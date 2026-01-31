import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  access: z.enum(["PUBLIC", "UNLISTED", "PREMIUM"]),
  premiumUnlockStars: z.number().int().min(0).max(1_000_000).optional().default(0),
  earlyAccessTier: z.enum(["BRONZE", "SILVER", "GOLD"]).nullable().optional().default(null),
  earlyAccessUntil: z.string().datetime().nullable().optional().default(null),
  gates: z
    .array(
      z.object({
        chain: z.string().min(2).max(20),
        collectionAddress: z.string().max(200).nullable().optional(),
        tokenMint: z.string().max(200).nullable().optional(),
        enabled: z.boolean().optional().default(true),
      })
    )
    .optional()
    .default([]),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const videoId = ctx.params.id;
  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ ok: false, message: "BAD_REQUEST" }, { status: 400 });

  const v = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true, authorId: true } });
  if (!v) return Response.json({ ok: false, message: "NOT_FOUND" }, { status: 404 });
  if (v.authorId !== userId && session?.user?.role !== "ADMIN") return Response.json({ ok: false, message: "FORBIDDEN" }, { status: 403 });

  const cfg = await getSiteConfig();
  const nftPremiumUnlockEnabled = Boolean((cfg as any).nftPremiumUnlockEnabled);

  // Early access applies to PUBLIC only. If any of tier/until is missing => disabled.
  const earlyTier = body.data.access === "PUBLIC" ? body.data.earlyAccessTier : null;
  const earlyUntil = body.data.access === "PUBLIC" ? (body.data.earlyAccessUntil ? new Date(body.data.earlyAccessUntil) : null) : null;
  const normalizeEarlyTier = earlyTier && earlyUntil ? earlyTier : null;
  const normalizeEarlyUntil = earlyTier && earlyUntil ? earlyUntil : null;

  await prisma.$transaction(async (tx) => {
    await tx.video.update({
      where: { id: videoId },
      data: {
        access: body.data.access as any,
        premiumUnlockStars: body.data.premiumUnlockStars,
        earlyAccessTier: normalizeEarlyTier as any,
        earlyAccessUntil: normalizeEarlyUntil,
      },
    });

    if (nftPremiumUnlockEnabled) {
      await tx.videoNftGate.deleteMany({ where: { videoId } });
      for (const g of body.data.gates) {
        if (!g.collectionAddress && !g.tokenMint) continue;
        await tx.videoNftGate.create({
          data: {
            videoId,
            chain: g.chain as any,
            collectionAddress: g.collectionAddress || null,
            tokenMint: g.tokenMint || null,
            enabled: Boolean(g.enabled),
          },
        });
      }
    }
  });

  return Response.json({ ok: true });
}
