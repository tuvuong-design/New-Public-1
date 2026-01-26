import { prisma } from "../../prisma";
import { Queue } from "bullmq";
import { connection } from "../../queues";

const qNft = new Queue("nft", { connection });

export async function nftRetryDeadLettersScanJob() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);

  const failedClips = await prisma.clipNft.findMany({
    where: {
      status: "FAILED",
      attemptCount: { lt: 3 },
      OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: cutoff } }],
    },
    take: 50,
    orderBy: { updatedAt: "asc" },
    select: { clipId: true },
  });

  for (const c of failedClips) {
    await qNft.add(
      "clip_mint_nft",
      { clipId: c.clipId, reason: "retry_dead_letters_scan" },
      { jobId: `clip_mint_nft:${c.clipId}`, removeOnComplete: true, removeOnFail: 1000 }
    );
  }

  return { ok: true, retried: failedClips.length };
}
