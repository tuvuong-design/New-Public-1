import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  packageId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const pkg = await prisma.starTopupPackage.findUnique({
    where: { id: parsed.data.packageId },
    include: { token: true },
  });
  if (!pkg || !pkg.active) return Response.json({ ok: false, error: "PACKAGE_NOT_FOUND" }, { status: 404 });

  const addr = await prisma.custodialAddress.findFirst({ where: { chain: pkg.chain, active: true }, orderBy: { createdAt: "asc" } });
  if (!addr) return Response.json({ ok: false, error: "NO_CUSTODIAL_ADDRESS" }, { status: 400 });

  const userId = (session.user as any).id as string;

  const deposit = await prisma.starDeposit.create({
    data: {
      userId,
      chain: pkg.chain,
      tokenId: pkg.tokenId,
      packageId: pkg.id,
      custodialAddressId: addr.id,
      expectedAmount: pkg.expectedAmount,
      memo: pkg.chain === "SOLANA" ? "" : undefined,
      status: "CREATED",
      provider: "MANUAL",
      events: {
        create: { type: "INTENT_CREATED", message: "User created deposit intent" },
      },
    },
    include: { token: true, custodialAddress: true, package: true },
  });

  // For Solana we recommend memo = depositId (auto-match)
  const memo = deposit.chain === "SOLANA" ? deposit.id : "";
  if (deposit.chain === "SOLANA") {
    await prisma.starDeposit.update({ where: { id: deposit.id }, data: { memo } });
  }

  return Response.json({
    ok: true,
    deposit: {
      id: deposit.id,
      chain: deposit.chain,
      assetSymbol: deposit.token?.symbol,
      expectedAmount: deposit.expectedAmount?.toString() || null,
      toAddress: deposit.custodialAddress.address,
      memo,
      stars: deposit.package?.stars || null,
    },
  });
}
