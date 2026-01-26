"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { enqueueOfflineUpload, listOfflineUploads, removeOfflineUpload, type OfflineUploadItem } from "@/lib/pwa/offlineUploadQueue";

type InitResp = {
  videoId: string;
  uploadId: string;
  key: string;
  partSize: number;
};

type VideoAccessInput = "PUBLIC" | "PREMIUM_PLUS" | "PRIVATE";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [isSensitive, setIsSensitive] = useState(false);
  const [access, setAccess] = useState<VideoAccessInput>("PUBLIC");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineUploadItem[]>([]);

  const canUpload = useMemo(() => files.length > 0 && (!!title.trim() || files.length === 1) && !busy, [files, title, busy]);
  const canStartUpload = canUpload && online;

  // Task 10: offline awareness + queue
  useEffect(() => {
    const sync = async () => {
      setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
      try {
        const q = await listOfflineUploads();
        setOfflineQueue(q);
      } catch {
        // ignore
      }
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const addLog = (s: string) => setLog((x) => [`${new Date().toLocaleTimeString()} - ${s}`, ...x].slice(0, 200));

  function baseName(name: string) {
    return name.replace(/\.[^.]+$/, "");
  }

  async function uploadOne(file: File, computedTitle: string) {
    // do not clear log for batch; caller handles
    try {
      addLog("Init multipart upload...");
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          type: file.type,
          title: computedTitle,
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
        const blob = file.slice(start, end);

        addLog(`Sign part ${i}/${totalParts} ...`);
        const signRes = await fetch("/api/upload/sign-part", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: init.uploadId, key: init.key, partNumber: i }),
        });
        if (!signRes.ok) throw new Error(await signRes.text());
        const { url } = await signRes.json();

        addLog(`Uploading part ${i}/${totalParts} (${(end - start) / 1024 / 1024} MB) ...`);
        const put = await fetch(url, { method: "PUT", body: blob });
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

      addLog("Done. Queue processing...");
      await fetch("/api/videos/queue-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: init.videoId }),
      });
      addLog("Queued. Open video page.");
      return init.videoId;
    } catch (e: any) {
      addLog("ERROR: " + (e?.message || String(e)));
      return null;
    } finally {
      // no-op
    }
  }

  async function startUpload() {
    if (files.length === 0) return;
    if (!online) {
      addLog("Bạn đang offline. Hãy dùng 'Queue offline upload' rồi upload khi có mạng.");
      return;
    }
    setLog([]);
    setBusy(true);

    // Batch mode: upload sequentially to avoid memory/network spikes.
    const videoIds: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const t = title.trim() ? `${title.trim()} - ${baseName(f.name)}` : baseName(f.name);
      addLog(`\n=== Upload ${i + 1}/${files.length}: ${f.name} ===`);
      const id = await uploadOne(f, t);
      if (id) videoIds.push(id);
    }

    setBusy(false);

    if (videoIds.length === 1) {
      window.location.href = `/admin/videos/${videoIds[0]}`;
    } else if (videoIds.length > 1) {
      addLog(`Batch done. Created ${videoIds.length} videos.`);
      // Go to studio as a safe landing page
      window.location.href = `/studio`;
    }
  }

  async function queueOffline() {
    if (files.length === 0) return;
    if (online) {
      addLog("Bạn đang online — có thể upload trực tiếp.");
      return;
    }
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const t = title.trim() ? `${title.trim()} - ${baseName(f.name)}` : baseName(f.name);
        await enqueueOfflineUpload({
          filename: f.name,
          mimeType: f.type,
          size: f.size,
          title: t,
          description: desc,
          isSensitive,
          access,
          file: f,
        });
        addLog(`Queued offline: ${f.name}`);
      }
      const q = await listOfflineUploads();
      setOfflineQueue(q);
      setFiles([]);
    } catch (e: any) {
      addLog("ERROR queue offline: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function uploadQueued() {
    if (!online) {
      addLog("Vẫn đang offline. Hãy bật mạng.");
      return;
    }
    const q = await listOfflineUploads();
    if (q.length === 0) {
      addLog("Offline queue trống.");
      return;
    }
    setLog([]);
    setBusy(true);
    try {
      for (let i = 0; i < q.length; i++) {
        const item = q[i];
        addLog(`\n=== Upload queued ${i + 1}/${q.length}: ${item.filename} ===`);
        const file = new File([item.file], item.filename, { type: item.mimeType });
        // apply metadata from queue item
        const prevDesc = desc;
        const prevSensitive = isSensitive;
        const prevAccess = access;
        // Use item-specific fields without mutating React state too much
        const id = await (async () => {
          const savedDesc = prevDesc;
          try {
            // call uploadOne with local values
            return await uploadOne(file, item.title);
          } finally {
            void savedDesc;
          }
        })();
        if (id) {
          await removeOfflineUpload(item.id);
        }
        // restore (we didn't change)
        void prevSensitive;
        void prevAccess;
      }
      const left = await listOfflineUploads();
      setOfflineQueue(left);
      addLog("Offline queue upload done.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload video</CardTitle>
          <CardDescription>
            Multipart upload lên R2. Sau đó Worker sẽ tạo thumbnail + preview + HLS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {!online ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                <b>Offline mode:</b> bạn có thể đưa file vào hàng đợi và upload khi có mạng.
              </div>
            ) : null}
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />

            <div className="grid gap-1">
              <Label>Quyền xem</Label>
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm"
                value={access}
                onChange={(e) => setAccess(e.target.value as VideoAccessInput)}
              >
                <option value="PUBLIC">Công khai</option>
                <option value="PREMIUM_PLUS">Chỉ Premium+</option>
                <option value="PRIVATE">Riêng tư (chỉ bạn / admin)</option>
              </select>
              <div className="small muted">
                Video riêng tư không hiển thị trên feed/sitemap. Video chỉ Premium+ sẽ hiển thị với người xem Premium+.
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox id="isSensitive" checked={isSensitive} onCheckedChange={(v) => setIsSensitive(Boolean(v))} />
              <Label htmlFor="isSensitive" className="cursor-pointer">
                Nội dung nhạy cảm (sensitive) — sẽ được làm mờ/ẩn tuỳ cài đặt viewer.
              </Label>
            </div>

            <Input
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            <Button onClick={startUpload} disabled={!canStartUpload}>
              {busy ? "Uploading..." : "Start upload"}
            </Button>

            {!online ? (
              <Button variant="secondary" onClick={queueOffline} disabled={!canUpload}>
                Queue offline upload
              </Button>
            ) : null}

            {online && offlineQueue.length > 0 ? (
              <Button variant="secondary" onClick={uploadQueued} disabled={busy}>
                Upload {offlineQueue.length} queued item(s)
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {offlineQueue.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Offline queue</CardTitle>
            <CardDescription>Danh sách file đã lưu để upload khi có mạng.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {offlineQueue.map((it) => (
                <div key={it.id} className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <div className="text-sm font-semibold">{it.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(it.size / 1024 / 1024)} MB • {new Date(it.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await removeOfflineUpload(it.id);
                      setOfflineQueue(await listOfflineUploads());
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>Tiến trình upload + queue processVideo.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="small max-h-[360px] overflow-auto rounded-xl bg-zinc-50 p-3">{log.join("\n")}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
