import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ walletId: z.string().min(10).max(40) });

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ ok: false, message: "BAD_REQUEST" }, { status: 400 });

  const row = await prisma.userWallet.findUnique({ where: { id: body.data.walletId }, select: { id: true, userId: true, chain: true, address: true } });
  if (!row || row.userId !== userId) return Response.json({ ok: false, message: "NOT_FOUND" }, { status: 404 });

  await prisma.userWallet.delete({ where: { id: row.id } });
  return Response.json({ ok: true });
}
