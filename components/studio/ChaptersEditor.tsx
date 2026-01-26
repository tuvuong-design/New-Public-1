"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type ChapterItem = { startSec: number; title: string };

function fmt(s: number) {
  const sec = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function ChaptersEditor({ videoId, initial }: { videoId: string; initial: ChapterItem[] }) {
  const [items, setItems] = useState<ChapterItem[]>(initial.length ? initial : [{ startSec: 0, title: "Intro" }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const normalized = useMemo(() => {
    return [...items]
      .map((c) => ({ startSec: Math.max(0, Math.floor(Number(c.startSec) || 0)), title: String(c.title || "").trim() }))
      .filter((c) => c.title.length > 0)
      .sort((a, b) => a.startSec - b.startSec);
  }, [items]);

  function update(i: number, patch: Partial<ChapterItem>) {
    setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function add() {
    setItems((prev) => [...prev, { startSec: Math.max(0, (prev.at(-1)?.startSec ?? 0) + 60), title: "" }]);
  }

  function remove(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/studio/videos/${videoId}/chapters`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chapters: normalized }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems((data.chapters ?? []).map((c: any) => ({ startSec: c.startSec, title: c.title })));
      setMsg("Saved");
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chapters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {msg ? <div className="text-sm text-muted-foreground">{msg}</div> : null}

          <div className="space-y-2">
            {items.map((c, i) => (
              <div key={i} className="grid grid-cols-[120px_1fr_90px] gap-2">
                <div>
                  <Input
                    type="number"
                    min={0}
                    value={c.startSec}
                    onChange={(e) => update(i, { startSec: Number(e.target.value) })}
                    placeholder="Start (sec)"
                  />
                  <div className="mt-1 text-xs text-muted-foreground">{fmt(c.startSec)}</div>
                </div>
                <Input value={c.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Title" />
                <Button variant="secondary" type="button" onClick={() => remove(i)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={add} variant="secondary">
              Add
            </Button>
            <Button type="button" onClick={save} disabled={busy}>
              Save
            </Button>
          </div>

          <div className="rounded-xl border bg-zinc-50 p-3 text-xs">
            <div className="font-semibold">Preview</div>
            <ul className="mt-2 space-y-1">
              {normalized.map((c, idx) => (
                <li key={idx}>
                  <span className="font-mono">{fmt(c.startSec)}</span> — {c.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
