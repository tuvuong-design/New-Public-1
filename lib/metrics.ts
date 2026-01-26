import type { PrismaClient } from "@prisma/client";

export function dayStartUtc(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

type MetricField = "views" | "likes" | "shares" | "comments" | "stars" | "gifts";

export async function incDailyMetric(tx: PrismaClient, videoId: string, field: MetricField, incBy = 1) {
  if (incBy <= 0) return;
  const day = dayStartUtc(new Date());
  const data: any = {};
  data[field] = { increment: incBy };

  await tx.videoMetricDaily.upsert({
    where: { videoId_day: { videoId, day } },
    update: data,
    create: { videoId, day, views: 0, likes: 0, shares: 0, comments: 0, stars: 0, gifts: 0, ...{ [field]: incBy } },
  });
}
