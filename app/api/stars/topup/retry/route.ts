import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queues } from "@/lib/queues";
import { z } from "zod";

const schema = z.object({ depositId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const userId = (session.user as any).id as string;
  const dep = await prisma.starDeposit.findUnique({ where: { id: parsed.data.depositId } });
  if (!dep || dep.userId !== userId) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  await prisma.starDepositEvent.create({ data: { depositId: dep.id, type: "USER_RETRY", message: "User requested retry reconcile" } });
  await queues.payments.add(
    "reconcile_deposit",
    { depositId: dep.id },
    { removeOnComplete: true, removeOnFail: 100, attempts: 10, backoff: { type: "exponential", delay: 5000 } }
  );
  return Response.json({ ok: true });
}
