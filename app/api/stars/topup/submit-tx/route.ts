import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { createFraudAlert } from "@/lib/payments/fraud";
import { queues } from "@/lib/queues";
import { z } from "zod";

const schema = z.object({
  depositId: z.string().min(1),
  txHash: z.string().min(12),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const userId = \(session\.user as any\)\.id as string;
const rl = await rateLimit(`topup:submit-tx:user:${userId}`, Number(process.env.TOPUP_SUBMIT_TX_LIMIT || 8), Number(process.env.TOPUP_SUBMIT_TX_WINDOW_MS || 10 * 60 * 1000));
if (!rl.ok) {
  await createFraudAlert({
    kind: "TOPUP_RATE_LIMIT",
    severity: "HIGH",
    dedupeKey: `${userId}:${Math.floor(Date.now() / Number(process.env.TOPUP_SUBMIT_TX_WINDOW_MS || 10 * 60 * 1000))}`,
    userId,
    title: "Topup submit-tx rate limit exceeded",
    message: `User exceeded submit-tx rate limit. resetAt=${new Date(rl.resetAt).toISOString()}`,
    payload: { remaining: rl.remaining, resetAt: rl.resetAt },
  }).catch(() => {});
  return Response.json({ ok: false, error: "RATE_LIMITED", resetAt: rl.resetAt }, { status: 429 });
}

  const dep = await prisma.starDeposit.findUnique({ where: { id: parsed.data.depositId }, include: { events: false } });
  if (!dep || dep.userId !== userId) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
// Anti-fraud: same txHash submitted for multiple deposits (often replay / copy-paste).
const existing = await prisma.starDeposit.findFirst({
  where: { txHash: parsed.data.txHash, NOT: { id: dep.id } },
  select: { id: true, userId: true, status: true },
});
if (existing && existing.userId && existing.userId !== userId) {
  await createFraudAlert({
    kind: "DUP_TX_HASH",
    severity: "CRITICAL",
    dedupeKey: parsed.data.txHash,
    userId,
    depositId: dep.id,
    title: "Duplicate txHash submitted across deposits",
    message: `txHash=${parsed.data.txHash} was already used by deposit ${existing.id}`,
    payload: { txHash: parsed.data.txHash, newDepositId: dep.id, existing },
  }).catch(() => {});
  // Mark for manual review; still allow reconcile to run (it may confirm the legit one).
  await prisma.starDepositEvent.create({ data: { depositId: dep.id, type: "FRAUD_DUP_TX_HASH", message: `Duplicate txHash detected: also in deposit ${existing.id}` } });
  await prisma.starDeposit.update({ where: { id: dep.id }, data: { status: "NEEDS_REVIEW", failureReason: "dup-tx-hash", txHash: parsed.data.txHash } });
  return Response.json({ ok: true, warning: "NEEDS_REVIEW_DUP_TX_HASH" });
}


  const updated = await prisma.starDeposit.update({
    where: { id: dep.id },
    data: {
      txHash: parsed.data.txHash,
      status: "SUBMITTED",
      provider: "MANUAL",
      events: { create: { type: "TX_SUBMITTED", message: "User submitted txHash" } },
    },
  });

  await queues.payments.add(
    "reconcile_deposit",
    { depositId: updated.id },
    { removeOnComplete: true, removeOnFail: 100, attempts: 10, backoff: { type: "exponential", delay: 5000 } }
  );

  return Response.json({ ok: true });
}
