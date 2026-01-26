import { prisma } from "../../prisma";
import { paymentsQueue } from "../../queues";
import { getPaymentConfigCached } from "./paymentConfig";

export async function reconcileStaleScanJob() {
  const cfg = await getPaymentConfigCached();
  const staleMs = Math.max(1, cfg.submittedStaleMinutes) * 60 * 1000;
  const cutoff = new Date(Date.now() - staleMs);

  const deposits = await prisma.starDeposit.findMany({
    where: {
      status: { in: ["SUBMITTED", "OBSERVED"] },
      updatedAt: { lt: cutoff },
      txHash: { not: null },
    },
    orderBy: { updatedAt: "asc" },
    take: 200,
  });

  let enqueued = 0;
  for (const d of deposits) {
    await paymentsQueue.add(
      "reconcile_deposit",
      { depositId: d.id },
      {
        jobId: `reconcile_deposit:${d.id}:${Math.floor(Date.now() / 60000)}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
    enqueued++;
  }

  return { staleMs, cutoff: cutoff.toISOString(), scanned: deposits.length, enqueued };
}
