import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queues } from "@/lib/queues";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const wallets = await prisma.userWallet.findMany({ where: { userId }, select: { chain: true, address: true } });
  if (wallets.length === 0) return Response.json({ ok: true, enqueued: 0 });

  await queues.nft.add(
    "nft_gate_sync",
    { reason: "user_manual_sync", addresses: wallets.map((w) => ({ chain: w.chain, address: w.address })) },
    { removeOnComplete: true, removeOnFail: 1000 }
  );

  return Response.json({ ok: true, enqueued: wallets.length });
}
