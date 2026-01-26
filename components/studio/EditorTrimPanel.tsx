"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type V = {
  id: string;
  title: string;
  durationSec: number;
  status: string;
  createdAt: string;
};

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function EditorTrimPanel({ videos }: { videos: V[] }) {
  const [videoId, setVideoId] = useState(videos[0]?.id ?? "");
  const cur = useMemo(() => videos.find((v) => v.id === videoId) ?? null, [videos, videoId]);

  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(cur?.durationSec ? cur.durationSec : 60);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function onChangeVideo(id: string) {
    setVideoId(id);
    const v = videos.find((x) => x.id === id);
    setStartSec(0);
    setEndSec(v?.durationSec ? v.durationSec : 60);
  }

  async function submit() {
    if (!videoId) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/studio/editor/trim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId, startSec: Math.floor(startSec), endSec: Math.floor(endSec) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || (await res.text()));
      setMsg(`Queued trim job: ${data.jobId}`);
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trim video</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {msg ? <div className="text-sm text-muted-foreground">{msg}</div> : null}

        <div className="grid gap-2">
          <div className="text-sm font-medium">Video</div>
          <Select value={videoId} onChange={(e) => onChangeVideo(e.target.value)}>
            <option value="" disabled>
              Select...
            </option>
            {videos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title} ({v.status})
              </option>
            ))}
          </Select>
          {cur ? (
            <div className="text-xs text-muted-foreground">
              Duration: {cur.durationSec}s ({fmt(cur.durationSec)}) • Created: {new Date(cur.createdAt).toLocaleString()}
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <div className="text-sm font-medium">Start (sec)</div>
            <Input type="number" min={0} value={startSec} onChange={(e) => setStartSec(Number(e.target.value))} />
            <div className="mt-1 text-xs text-muted-foreground font-mono">{fmt(startSec)}</div>
          </div>
          <div>
            <div className="text-sm font-medium">End (sec)</div>
            <Input type="number" min={1} value={endSec} onChange={(e) => setEndSec(Number(e.target.value))} />
            <div className="mt-1 text-xs text-muted-foreground font-mono">{fmt(endSec)}</div>
          </div>
        </div>

        <Button type="button" onClick={submit} disabled={busy || !videoId}>
          Queue trim
        </Button>
      </CardContent>
    </Card>
  );
}
