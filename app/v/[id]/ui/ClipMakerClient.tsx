"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClipMakerClient({ videoId }: { videoId: string }) {
  const { data: session } = useSession();
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(15);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [clipId, setClipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session?.user) return null;

  async function create() {
    setError(null);
    setCreating(true);
    setClipId(null);
    try {
      const res = await fetch("/api/studio/clips/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId, startSec: Number(startSec), endSec: Number(endSec), title: title || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "CREATE_FAILED");
      setClipId(data.clipId);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">Tạo Clip (15–60s)</div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Start (sec)</div>
          <Input value={startSec} onChange={(e) => setStartSec(Number(e.target.value || 0))} type="number" min={0} />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">End (sec)</div>
          <Input value={endSec} onChange={(e) => setEndSec(Number(e.target.value || 0))} type="number" min={1} />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Title (optional)</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={create} disabled={creating}>
          {creating ? "Đang tạo..." : "Tạo clip"}
        </Button>
        {clipId ? (
          <a className="text-sm underline" href={`/clip/${clipId}`}>
            Mở clip
          </a>
        ) : null}
      </div>

      {error ? <div className="text-sm text-red-400">{error}</div> : null}
      <div className="text-xs text-muted-foreground">Clip sẽ được xử lý bằng worker (ffmpeg) và gắn watermark.</div>
    </div>
  );
}
