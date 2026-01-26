import { cache } from "react";
import { prisma } from "./prisma";

export const getSiteConfig = cache(async () => {
  return prisma.siteConfig.upsert({ where: { id: 1 }, update: {}, create: {} });
});

export const getHlsConfig = cache(async () => {
  return prisma.hlsConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      segmentSeconds: 6,
      packaging: "SINGLE_FILE",
      ladderJson: JSON.stringify([
        { height: 1080, videoKbps: 5000, audioKbps: 128, maxMb: 200 },
        { height: 720, videoKbps: 2800, audioKbps: 128, maxMb: 200 },
        { height: 480, videoKbps: 1400, audioKbps: 96, maxMb: 200 },
        { height: 360, videoKbps: 900, audioKbps: 64, maxMb: 200 }
      ]),
    },
  });
});
