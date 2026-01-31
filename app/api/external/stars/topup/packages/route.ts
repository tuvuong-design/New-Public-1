import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";

export const runtime = "nodejs";

const querySchema = z.object({
  chain: z.string().optional(),
});

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["PUBLIC_READ"] });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function GET(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["PUBLIC_READ"] });
  if (!g.ok) return g.res;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return withCors(jsonError(400, "Query không hợp lệ", parsed.error.flatten()), g.origin);

  const where: any = { active: true };
  if (parsed.data.chain) where.chain = parsed.data.chain;

  const rows = await prisma.starTopupPackage.findMany({
    where,
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
    include: { token: true },
  });

  const data = rows.map((p) => ({
    id: p.id,
    name: p.name,
    chain: p.chain,
    expectedAmount: p.expectedAmount.toString(),
    stars: p.stars,
    bonusStars: p.bonusStars,
    bundleLabel: p.bundleLabel,
    token: { id: p.token.id, symbol: p.token.symbol, decimals: p.token.decimals },
  }));

  return withCors(NextResponse.json({ ok: true, data }), g.origin);
}
