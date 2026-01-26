import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const querySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_QUERY" }, { status: 400 });

  const take = parsed.data.take ?? 50;

  const users = await prisma.user.findMany({
    orderBy: [{ xp: "desc" }, { level: "desc" }, { createdAt: "asc" }],
    take,
    select: { id: true, name: true, xp: true, level: true, membershipTier: true, membershipExpiresAt: true },
  });

  return Response.json({
    ok: true,
    items: users.map((u, idx) => ({
      rank: idx + 1,
      id: u.id,
      name: u.name,
      xp: u.xp,
      level: u.level,
      membershipTier: u.membershipTier,
      membershipExpiresAt: u.membershipExpiresAt ? u.membershipExpiresAt.toISOString() : null,
    })),
  });
}
