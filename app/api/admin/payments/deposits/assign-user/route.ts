import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { queues } from "@/lib/queues";
import { z } from "zod";

const schema = z.object({
  depositId: z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: Request) {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return Response.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  const dep = await prisma.starDeposit.findUnique({ where: { id: parsed.data.depositId } });
  if (!dep) return Response.json({ ok: false, error: "DEPOSIT_NOT_FOUND" }, { status: 404 });

  await prisma.starDeposit.update({
    where: { id: dep.id },
    data: {
      userId: user.id,
      status: dep.status === "UNMATCHED" ? "CONFIRMED" : dep.status,
      failureReason: null,
      events: { create: { type: "ADMIN_ASSIGN_USER", message: `Assigned to user ${user.email}` } },
    },
  });

  await queues.payments.add(
    "reconcile_deposit",
    { depositId: dep.id },
    { removeOnComplete: true, removeOnFail: 100, attempts: 10, backoff: { type: "exponential", delay: 5000 } }
  );

  return Response.json({ ok: true });
}
