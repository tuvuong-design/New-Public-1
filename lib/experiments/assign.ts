import { prisma } from "@/lib/prisma";

function hash32(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

export async function getAssignedVideoExperimentVariant(videoId: string, vsid: string | null | undefined) {
  if (!vsid) return null;

  const exp = await prisma.videoExperiment.findFirst({
    where: { videoId, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
    include: { variants: { orderBy: { name: "asc" } } },
  });

  if (!exp || exp.variants.length === 0) return null;

  const idx = hash32(`${vsid}:${exp.id}`) % exp.variants.length;
  const variant = exp.variants[idx];

  return { experiment: exp, variant };
}
