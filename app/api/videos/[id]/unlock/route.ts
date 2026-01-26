import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";
import { auth } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  // Optional: client idempotency key for safe retries.
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  if (!viewerId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const videoId = ctx.params.id;
  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  const idempotencyKey = body.success ? body.data.idempotencyKey : undefined;

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, authorId: true, status: true, access: true, premiumUnlockStars: true },
  });
  if (!video) return Response.json({ ok: false, message: "VIDEO_NOT_FOUND" }, { status: 404 });
  if (video.status !== "PUBLISHED") return Response.json({ ok: false, message: "NOT_PUBLISHED" }, { status: 400 });
  if (video.access !== "PREMIUM") return Response.json({ ok: false, message: "NOT_PREMIUM" }, { status: 400 });

  // Owner/admin can already view; unlocking is for regular viewers.
  if (viewerId === video.authorId || session?.user?.role === "ADMIN") {
    return Response.json({ ok: true, alreadyAllowed: true });
  }

  const cost = Number(video.premiumUnlockStars ?? 0);
  if (!Number.isFinite(cost) || cost <= 0) {
    return Response.json({ ok: false, message: "MEMBERSHIP_ONLY" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.videoUnlock.findUnique({ where: { userId_videoId: { userId: viewerId, videoId } } });
    if (existing) return { ok: true as const, unlocked: true as const, starsCost: existing.starsCost, already: true };

    const u = await tx.user.findUnique({ where: { id: viewerId }, select: { starBalance: true } });
    if (!u) throw new Error("USER_NOT_FOUND");
    if ((u.starBalance ?? 0) < cost) throw new Error("INSUFFICIENT_STARS");

    await tx.user.update({ where: { id: viewerId }, data: { starBalance: { decrement: cost } } });

    const st = await tx.starTransaction.create({
      data: {
        userId: viewerId,
        delta: -cost,
        stars: cost,
        type: "PREMIUM_VIDEO_UNLOCK",
        videoId,
        note: `premium_video_unlock\nvideoId=${videoId}\nauthorId=${video.authorId ?? ""}\n${idempotencyKey ? `idem=${idempotencyKey}` : ""}`,
      },
    });

    await tx.videoUnlock.create({
      data: {
        userId: viewerId,
        videoId,
        starsCost: cost,
        starTxId: st.id,
      },
    });

    return { ok: true as const, unlocked: true as const, starsCost: cost, already: false };
  });

  return Response.json(result);
}
