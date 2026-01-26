import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { incDailyMetric } from "@/lib/metrics";
import { incBoostStat } from "@/lib/boost";

const schema = z.object({ videoId: z.string().min(1) });

export async function POST(req: Request) {
  const body = schema.parse(await req.json());
  await prisma.$transaction(async (tx) => {
    await tx.video.update({ where: { id: body.videoId }, data: { viewCount: { increment: 1 } } });
    await incDailyMetric(tx as any, body.videoId, "views", 1);
    await incBoostStat(tx as any, body.videoId, "statViews", 1);
  });
  return Response.json({ ok: true });
}
