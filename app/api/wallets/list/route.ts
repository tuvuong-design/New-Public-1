import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const wallets = await prisma.userWallet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, chain: true, address: true, verifiedAt: true, createdAt: true, updatedAt: true },
  });

  return Response.json({ ok: true, wallets });
}
