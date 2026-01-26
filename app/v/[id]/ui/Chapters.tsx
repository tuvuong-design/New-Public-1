"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";

export type Chapter = { startSec: number; title: string };

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function Chapters({ videoId, chapters }: { videoId: string; chapters: Chapter[] }) {
  const items = useMemo(() => {
    return [...chapters]
      .map((c) => ({ startSec: Math.max(0, Math.floor(c.startSec)), title: String(c.title || "").trim() }))
      .filter((c) => c.title)
      .sort((a, b) => a.startSec - b.startSec);
  }, [chapters]);

  if (items.length === 0) return null;

  function seek(t: number) {
    window.dispatchEvent(new CustomEvent("videoshare:player:seek", { detail: { videoId, timeSec: t } }));
  }

  return (
    <div className="card mt-4">
      <div className="text-lg font-extrabold">Chapters</div>
      <div className="small muted mt-1">Bấm để tua nhanh đến đoạn tương ứng.</div>
      <div className="mt-3 grid gap-2">
        {items.map((c, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{c.title}</div>
              <div className="text-xs text-muted-foreground font-mono">{fmt(c.startSec)}</div>
            </div>
            <Button type="button" variant="secondary" onClick={() => seek(c.startSec)}>
              Tua
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
