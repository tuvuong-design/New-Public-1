import { prisma } from "../../prisma";
import { paymentsQueue } from "../../queues";

export async function retryDeadLettersScanJob() {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  const logs = await prisma.webhookAuditLog.findMany({
    where: {
      status: "FAILED",
      createdAt: { lt: cutoff, gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      // Don't retry hard rejects
      NOT: [{ failureReason: { startsWith: "signature" } }, { failureReason: { startsWith: "invalid" } }],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  let retried = 0;
  for (const l of logs) {
    await prisma.webhookAuditLog.update({ where: { id: l.id }, data: { status: "RECEIVED", failureReason: null } });
    await paymentsQueue.add(
      "process_webhook_audit",
      { auditLogId: l.id },
      {
        jobId: `process_webhook_audit:${l.id}:${Math.floor(Date.now() / 60000)}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
      },
    );
    retried++;
  }

  return { scanned: logs.length, retried };
}
