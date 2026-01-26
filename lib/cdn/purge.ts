import { queues } from "@/lib/queues";

// Smart purge strategy:
// - R2 object keys are immutable/versioned, so media URLs don't need purge.
// - UI pages (Next routes) may be cached at CDN edge; purge these paths when
//   publish/unpublish/update thumbnail to reduce stale UI.
//
// Best-effort: if Redis isn't configured or queue fails, we ignore.
export async function enqueueCdnPurgePaths(paths: string[], reason: string) {
  const uniq = Array.from(new Set(paths.filter(Boolean)));
  if (!uniq.length) return;
  try {
    await queues.cdn.add(
      "purge_paths",
      { paths: uniq, reason },
      {
        removeOnComplete: 1000,
        removeOnFail: 1000,
        jobId: `purge_paths:${reason}:${uniq.join(",").slice(0, 200)}`,
      },
    );
  } catch {
    // ignore
  }
}
