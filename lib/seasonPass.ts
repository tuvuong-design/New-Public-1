import { prisma } from "@/lib/prisma";

export async function getActiveSeasonPass(userId: string) {
  const now = new Date();
  return prisma.seasonPass.findFirst({
    where: { userId, status: "ACTIVE", endsAt: { gt: now } },
    select: { id: true, startsAt: true, endsAt: true },
  });
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
