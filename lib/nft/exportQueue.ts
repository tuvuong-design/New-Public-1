import { queues } from "@/lib/queues";

export async function enqueueNftExportPrepare(exportRequestId: string) {
  await queues.nft.add(
    "nft_export_prepare",
    { exportRequestId },
    { removeOnComplete: true, removeOnFail: 100 }
  );
}

export async function enqueueNftExportVerify(exportRequestId: string) {
  await queues.nft.add(
    "nft_export_verify_tx",
    { exportRequestId },
    {
      attempts: 10,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}
