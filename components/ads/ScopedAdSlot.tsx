"use client";

import { useEffect, useState } from "react";
import AdSlot from "@/components/ads/AdSlot";

type Scope = "FEED" | "VIDEO" | "COMMENTS" | "RELATED" | "GLOBAL_TOP" | "GLOBAL_BOTTOM";

type Placement = { enabled: boolean; everyN: number; html: string };

export default function ScopedAdSlot({ scope }: { scope: Scope }) {
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/ads?scope=${scope}`, { cache: "no-store" });
      if (!res.ok) {
        setPlacement(null);
        return;
      }
      const data = await res.json();
      setPlacement(data);
    })();
  }, [scope]);

  if (!placement?.enabled) return null;

  return <AdSlot html={placement.html} />;
}
