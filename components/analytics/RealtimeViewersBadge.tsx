"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function RealtimeViewersBadge({ videoId }: { videoId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch(`/api/analytics/realtime?videoId=${encodeURIComponent(videoId)}`, { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (j?.ok) setCount(Number(j.count ?? 0));
      } catch {
        if (alive) setCount(null);
      }
    }
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [videoId]);

  if (count == null) return null;
  return (
    <Badge variant="secondary" title="Realtime viewers (last 60s)">
      {count} online
    </Badge>
  );
}
