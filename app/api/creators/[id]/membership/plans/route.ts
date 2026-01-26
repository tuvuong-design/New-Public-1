import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const creatorId = ctx.params.id;
  const plans = await prisma.creatorMembershipPlan.findMany({
    where: { userId: creatorId, isActive: true },
    orderBy: [{ sort: "asc" }, { starsPrice: "asc" }],
    select: { id: true, title: true, starsPrice: true, durationDays: true, benefits: true, tier: true },
  });

  return Response.json({ ok: true, plans });
}
