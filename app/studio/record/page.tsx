"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type InitResp = {
  videoId: string;
  uploadId: string;
  key: string;
  partSize: number;
};

type VideoAccessInput = "PUBLIC" | "PREMIUM_PLUS" | "PRIVATE";

export default function StudioRecordPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const [title, setTitle] = useState("Screen Record");
  const [desc, setDesc] = useState("");
  const [isSensitive, setIsSensitive] = useState(false);
  const [access, setAccess] = useState<VideoAccessInput>("PUBLIC");

  const canStart = !recording && !busy;
  const canStop = recording && !busy;

  const canUpload = useMemo(() => !!blob && !busy && title.trim().length > 0, [blob, busy, title]);

  useEffect(() => {
    return () => {
      try { stream?.getTracks().forEach((t) => t.stop()); } catch {}
    };
  }, [stream]);

  function addLog(s: string) {
    setLog((x) => [`${new Date().toLocaleTimeString()} - ${s}`, ...x].slice(0, 200));
  }

  async function start() {
    setLog([]);
    setBlob(null);
    setChunks([]);
    try {
      const s = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s as any;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      const preferred = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      const mimeType = preferred.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || "video/webm";

      const r = new MediaRecorder(s, { mimeType });
      setRecorder(r);
      r.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current = [...chunksRef.current, e.data];
          setChunks((prev) => [...prev, e.data]);
        }
      };
      r.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
        setBlob(b);
        addLog(`Stopped. Size ${(b.size / 1024 / 1024).toFixed(2)} MB`);
      };

      chunksRef.current = [];
      r.start(1000);
      setRecording(true);
      addLog("Recording started");

      // Stop if user ends sharing.
      s.getVideoTracks()[0]?.addEventListener("ended", () => {
        try { r.stop(); } catch {}
      });
    } catch (e: any) {
      addLog("ERROR: " + (e?.message || String(e)));
    }
  }

  const chunksRef = useRef<Blob[]>([]);
  useEffect(() => { chunksRef.current = chunks; }, [chunks]);

  async function stop() {
    if (!recorder) return;
    try {
      recorder.stop();
    } catch {}
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    setStream(null);
    setRecorder(null);
    setRecording(false);
  }

  async function uploadRecorded() {
    if (!blob) return;
    setBusy(true);
    setLog([]);
    try {
      const file = new File([blob], `record-${Date.now()}.webm`, { type: "video/webm" });

      addLog("Init multipart upload...");
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          type: file.type,
          title: title.trim(),
          description: desc,
          isSensitive,
          access,
        }),
      });
      if (!initRes.ok) throw new Error(await initRes.text());
      const init: InitResp = await initRes.json();

      const partSize = init.partSize;
      const totalParts = Math.ceil(file.size / partSize);
      const etags: { PartNumber: number; ETag: string }[] = [];

      for (let i = 1; i <= totalParts; i++) {
        const start = (i - 1) * partSize;
        const end = Math.min(i * partSize, file.size);
        const part = file.slice(start, end);

        addLog(`Sign part ${i}/${totalParts} ...`);
        const signRes = await fetch("/api/upload/sign-part", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: init.uploadId, key: init.key, partNumber: i }),
        });
        if (!signRes.ok) throw new Error(await signRes.text());
        const { url } = await signRes.json();

        addLog(`Uploading part ${i}/${totalParts} ...`);
        const put = await fetch(url, { method: "PUT", body: part });
        if (!put.ok) throw new Error(`PUT failed ${put.status}`);
        const etag = put.headers.get("etag") || put.headers.get("ETag");
        if (!etag) throw new Error("Missing ETag from upload response");
        etags.push({ PartNumber: i, ETag: etag.replaceAll('"', "") });
      }

      addLog("Complete multipart...");
      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: init.videoId, uploadId: init.uploadId, key: init.key, parts: etags }),
      });
      if (!completeRes.ok) throw new Error(await completeRes.text());
      await completeRes.json();

      addLog("Queue processing...");
      await fetch("/api/videos/queue-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: init.videoId }),
      });

      addLog("Done. Opening video...");
      window.location.href = `/admin/videos/${init.videoId}`;
    } catch (e: any) {
      addLog("ERROR: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Screen recording</CardTitle>
          <CardDescription>Ghi màn hình (browser MediaRecorder) rồi upload theo multipart.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={start} disabled={!canStart}>
              Start recording
            </Button>
            <Button type="button" variant="secondary" onClick={stop} disabled={!canStop}>
              Stop
            </Button>
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium">Preview</div>
            <video ref={videoRef} controls className="w-full rounded-xl border bg-black" />
          </div>

          {blob ? (
            <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
              Recorded: {(blob.size / 1024 / 1024).toFixed(2)} MB
            </div>
          ) : null}

          <div className="grid gap-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />

            <div className="flex items-center gap-2">
              <Checkbox checked={isSensitive} onCheckedChange={(v) => setIsSensitive(Boolean(v))} />
              <Label>Sensitive</Label>
            </div>

            <div className="grid gap-1">
              <Label>Access</Label>
              <select
                value={access}
                onChange={(e) => setAccess(e.target.value as any)}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="PREMIUM_PLUS">PREMIUM_PLUS</option>
                <option value="PRIVATE">PRIVATE</option>
              </select>
              <div className="text-xs text-muted-foreground">PREMIUM_PLUS/PRIVATE yêu cầu đăng nhập.</div>
            </div>

            <Button type="button" onClick={uploadRecorded} disabled={!canUpload}>
              Upload recorded video
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm">
            {log.length === 0 ? <div className="text-muted-foreground">(empty)</div> : null}
            {log.map((l, i) => (
              <div key={i} className="font-mono text-xs">
                {l}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
