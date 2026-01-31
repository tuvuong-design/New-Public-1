import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardExternal(req, { scopes: ["USER_READ"], requireAuth: true });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardExternal(req, { scopes: ["USER_READ"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;

  const dep = await prisma.starDeposit.findUnique({
    where: { id: params.id },
    include: { token: true, package: true, custodialAddress: true },
  });
  if (!dep || dep.userId !== g.user!.id) return withCors(jsonError(404, "Không tìm thấy deposit"), g.origin);

  return withCors(NextResponse.json({
    ok: true,
    deposit: {
      id: dep.id,
      chain: dep.chain,
      status: dep.status,
      expectedAmount: dep.expectedAmount?.toString() ?? null,
      actualAmount: dep.actualAmount?.toString() ?? null,
      txHash: dep.txHash,
      memo: dep.memo,
      depositAddress: dep.custodialAddress.address,
      token: dep.token ? { id: dep.token.id, symbol: dep.token.symbol, decimals: dep.token.decimals } : null,
      package: dep.package ? { id: dep.package.id, name: dep.package.name, stars: dep.package.stars, bonusStars: dep.package.bonusStars } : null,
      createdAt: dep.createdAt,
      confirmedAt: dep.confirmedAt,
      creditedAt: dep.creditedAt,
    }
  }), g.origin);
}
