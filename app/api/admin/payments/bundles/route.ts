import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  packageId: z.string().min(1),
  bonusStars: z.number().int().min(0).max(10_000).optional(),
  bundleLabel: z.string().max(80).optional().nullable(),
  active: z.boolean().optional(),
  sort: z.number().int().optional(),
});

export async function GET() {
  const session = await auth();
  requireAdmin(session);
  const packages = await prisma.starTopupPackage.findMany({
    orderBy: [{ chain: "asc" }, { sort: "asc" }, { stars: "asc" }],
    include: { token: true },
  });
  return Response.json({ ok: true, packages });
}

export async function POST(req: Request) {
  const session = await auth();
  requireAdmin(session);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const d = parsed.data;
  const pkg = await prisma.starTopupPackage.update({
    where: { id: d.packageId },
    data: {
      bonusStars: d.bonusStars ?? undefined,
      bundleLabel: d.bundleLabel === undefined ? undefined : (d.bundleLabel || null),
      active: d.active ?? undefined,
      sort: d.sort ?? undefined,
    },
    include: { token: true },
  });
  return Response.json({ ok: true, package: pkg });
}
