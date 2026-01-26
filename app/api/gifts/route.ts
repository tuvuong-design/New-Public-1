import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const gifts = await prisma.gift.findMany({
    where: { active: true },
    orderBy: [{ sort: "asc" }, { starsCost: "asc" }, { name: "asc" }],
    select: { id: true, name: true, icon: true, starsCost: true },
    take: 100,
  });
  return Response.json({ ok: true, gifts });
}
