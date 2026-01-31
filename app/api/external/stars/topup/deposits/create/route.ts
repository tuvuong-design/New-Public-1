import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardExternal } from "@/lib/api/externalGuards";
import { withCors } from "@/lib/api/cors";
import { jsonError } from "@/lib/api/errors";

export const runtime = "nodejs";

const schema = z.object({
  packageId: z.string().min(1),
  couponCode: z.string().max(64).optional(),
});

export async function OPTIONS(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["USER_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;
  return withCors(new NextResponse(null, { status: 204 }), g.origin);
}

export async function POST(req: NextRequest) {
  const g = await guardExternal(req, { scopes: ["USER_WRITE"], requireAuth: true, strictScopes: true });
  if (!g.ok) return g.res;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return withCors(jsonError(400, "Dữ liệu không hợp lệ", parsed.error.flatten()), g.origin);

  const pack = await prisma.starTopupPackage.findFirst({
    where: { id: parsed.data.packageId, active: true },
    include: { token: true },
  });
  if (!pack) return withCors(jsonError(404, "Không tìm thấy gói nạp sao"), g.origin);

  const addr = await prisma.custodialAddress.findFirst({
    where: { chain: pack.chain, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!addr) return withCors(jsonError(500, "Chưa cấu hình địa chỉ nạp cho chain này"), g.origin);

  // Deposit memo: dùng id để đối soát (đặc biệt Solana)
  const deposit = await prisma.starDeposit.create({
    data: {
      userId: g.user!.id,
      chain: pack.chain,
      tokenId: pack.tokenId,
      packageId: pack.id,
      couponCode: parsed.data.couponCode,
      custodialAddressId: addr.id,
      expectedAmount: pack.expectedAmount,
      memo: "", // set after create
    },
  });
  const memo = deposit.id;
  await prisma.starDeposit.update({ where: { id: deposit.id }, data: { memo } });

  return withCors(NextResponse.json({
    ok: true,
    deposit: {
      id: deposit.id,
      chain: deposit.chain,
      token: { symbol: pack.token.symbol, decimals: pack.token.decimals },
      expectedAmount: pack.expectedAmount.toString(),
      stars: pack.stars,
      bonusStars: pack.bonusStars,
      depositAddress: addr.address,
      memo,
      status: deposit.status,
      createdAt: deposit.createdAt,
    }
  }), g.origin);
}
