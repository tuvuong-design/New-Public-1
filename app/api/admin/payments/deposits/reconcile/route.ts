import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { queues } from "@/lib/queues";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ depositId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const dep = await prisma.starDeposit.findUnique({ where: { id: parsed.data.depositId } });
  if (!dep) return Response.json({ ok: false, error: "DEPOSIT_NOT_FOUND" }, { status: 404 });

  await queues.payments.add(
    "reconcile_deposit",
    { depositId: dep.id },
    { removeOnComplete: true, removeOnFail: 100, attempts: 10, backoff: { type: "exponential", delay: 5000 } }
  );

  return Response.json({ ok: true });
}
