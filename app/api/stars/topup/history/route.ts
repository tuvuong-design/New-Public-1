import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const deposits = await prisma.starDeposit.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { token: true, package: true },
  });
  return Response.json({
    ok: true,
    deposits: deposits.map((d) => ({
      id: d.id,
      chain: d.chain,
      assetSymbol: d.token?.symbol || null,
      expectedAmount: d.expectedAmount?.toString() || null,
      actualAmount: d.actualAmount?.toString() || null,
      txHash: d.txHash,
      status: d.status,
      createdAt: d.createdAt,
    })),
  });
}
