import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/requestIp";
import { sha256Hex } from "@/lib/hash";
import { queues } from "@/lib/queues";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  videoId: z.string().min(1),
  reason: z.string().min(2).max(80),
  details: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;

  const ip = getClientIp(req);
  const ipHash = sha256Hex(ip);

  const body = schema.parse(await req.json());
  const details = (body.details ?? "").trim().slice(0, 1000);

  // Avoid spam: same ip/video within last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.videoReport.findFirst({
    where: { videoId: body.videoId, ipHash, createdAt: { gte: since } },
    select: { id: true },
  });
  if (existing) return Response.json({ ok: true, message: "Already reported recently" });

  const created = await prisma.videoReport.create({
    data: {
      videoId: body.videoId,
      reporterId: uid ?? null,
      reason: body.reason,
      details: details || null,
      ipHash,
      status: "OPEN",
    },
    select: { id: true },
  });

  // Async moderation pipeline (best-effort)
  queues.moderation.add(
    "review_report",
    { kind: "video", reportId: created.id },
    { removeOnComplete: 1000, removeOnFail: 1000, jobId: `moderation:video:${created.id}` },
  ).catch(() => {});

  return Response.json({ ok: true });
}
