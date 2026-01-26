import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.SITE_URL;
  const videos = await prisma.video.findMany({
    where: { status: "PUBLISHED", access: "PUBLIC" },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });

  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/feed`, lastModified: new Date() },
    ...videos.map((v) => ({ url: `${base}/v/${v.id}`, lastModified: v.updatedAt })),
  ];
}
