"use client";

import { useEffect, useMemo, useState } from "react";
import AdSlot from "./AdSlot";

type Placement = { enabled: boolean; everyN: number; html: string };

export default function AdStream({
  scope,
  positions,
}: {
  scope: "FEED" | "VIDEO" | "COMMENTS" | "RELATED";
  positions: number[];
}) {
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/ads?scope=${scope}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPlacement(data);
    })();
  }, [scope]);

  const shouldShow = useMemo(() => placement?.enabled && placement.everyN > 0, [placement]);

  if (!shouldShow || !placement) return null;

  return (
    <>
      {positions.map((pos) => (
        <div key={pos} style={{ margin: "10px 0" }}>
          <AdSlot html={placement.html} />
        </div>
      ))}
    </>
  );
}
