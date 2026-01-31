"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type Row = any;

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error(data?.error || data?.message || txt || `HTTP ${res.status}`);
  return data;
}

export default function StorageConfigForm({ row }: { row: Row }) {
  // Current config values
  const [r2PublicBaseUrlA, setR2PublicBaseUrlA] = useState<string>(String(row.r2PublicBaseUrlA || ""));
  const [r2PublicBaseUrlB, setR2PublicBaseUrlB] = useState<string>(String(row.r2PublicBaseUrlB || ""));
  const [r2AbSplitPercent, setR2AbSplitPercent] = useState<string>(String(row.r2AbSplitPercent ?? 50));

  const [ftpOriginEnabled, setFtpOriginEnabled] = useState<boolean>(Boolean(row.ftpOriginEnabled));
  const [ftpOriginUploadEnabled, setFtpOriginUploadEnabled] = useState<boolean>(Boolean(row.ftpOriginUploadEnabled));
  const [ftpOriginHost, setFtpOriginHost] = useState<string>(row.ftpOriginHost || "");
  const [ftpOriginPort, setFtpOriginPort] = useState<number>(Number(row.ftpOriginPort || 21));
  const [ftpOriginUsername, setFtpOriginUsername] = useState<string>(row.ftpOriginUsername || "");
  const [ftpOriginPassword, setFtpOriginPassword] = useState<string>("");
  const [ftpOriginBasePath, setFtpOriginBasePath] = useState<string>(row.ftpOriginBasePath || "");
  const [ftpOriginPublicBaseUrl, setFtpOriginPublicBaseUrl] = useState<string>(row.ftpOriginPublicBaseUrl || "");

  const [ftpHlsEnabled, setFtpHlsEnabled] = useState<boolean>(Boolean(row.ftpHlsEnabled));
  const [ftpHlsUploadEnabled, setFtpHlsUploadEnabled] = useState<boolean>(Boolean(row.ftpHlsUploadEnabled));
  const [ftpHlsHost, setFtpHlsHost] = useState<string>(row.ftpHlsHost || "");
  const [ftpHlsPort, setFtpHlsPort] = useState<number>(Number(row.ftpHlsPort || 21));
  const [ftpHlsUsername, setFtpHlsUsername] = useState<string>(row.ftpHlsUsername || "");
  const [ftpHlsPassword, setFtpHlsPassword] = useState<string>("");
  const [ftpHlsBasePath, setFtpHlsBasePath] = useState<string>(row.ftpHlsBasePath || "");
  const [ftpHlsPublicBaseUrl, setFtpHlsPublicBaseUrl] = useState<string>(row.ftpHlsPublicBaseUrl || "");

  const [driveEnabled, setDriveEnabled] = useState<boolean>(Boolean(row.driveEnabled));
  const [driveFolderId, setDriveFolderId] = useState<string>(row.driveFolderId || "");
  const [driveServiceAccountJson, setDriveServiceAccountJson] = useState<string>("");

  const pendingApplyAt = row.pendingApplyAt ? new Date(row.pendingApplyAt).toLocaleString() : null;
  const hasPending = Boolean(row.pendingJson && row.pendingApplyAt);

  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState<string>("");

  const ftpOriginPayload = useMemo(() => ({
    host: ftpOriginHost,
    port: ftpOriginPort,
    username: ftpOriginUsername,
    password: ftpOriginPassword,
    basePath: ftpOriginBasePath,
  }), [ftpOriginHost, ftpOriginPort, ftpOriginUsername, ftpOriginPassword, ftpOriginBasePath]);

  const ftpHlsPayload = useMemo(() => ({
    host: ftpHlsHost,
    port: ftpHlsPort,
    username: ftpHlsUsername,
    password: ftpHlsPassword,
    basePath: ftpHlsBasePath,
  }), [ftpHlsHost, ftpHlsPort, ftpHlsUsername, ftpHlsPassword, ftpHlsBasePath]);

  const drivePayload = useMemo(() => ({
    folderId: driveFolderId,
    serviceAccountJson: driveServiceAccountJson,
  }), [driveFolderId, driveServiceAccountJson]);

  async function verifyFtp(which: "origin" | "hls") {
    try {
      setBusy(`verify_${which}`);
      setMsg("");
      const payload = which === "origin" ? ftpOriginPayload : ftpHlsPayload;
      const out = await postJson("/api/admin/storage/ftp/verify", { which, ...payload });
      setMsg(out?.message || `FTP ${which} OK`);
    } catch (e: any) {
      setMsg(`Error: ${e?.message || e}`);
    } finally {
      setBusy("");
    }
  }

  async function testUploadFtp(which: "origin" | "hls") {
    try {
      setBusy(`test_${which}`);
      setMsg("");
      const payload = which === "origin" ? ftpOriginPayload : ftpHlsPayload;
      const out = await postJson("/api/admin/storage/ftp/test-upload", { which, ...payload });
      setMsg(out?.message || `FTP ${which} test upload OK`);
    } catch (e: any) {
      setMsg(`Error: ${e?.message || e}`);
    } finally {
      setBusy("");
    }
  }

  async function verifyDrive() {
    try {
      setBusy("verify_drive");
      setMsg("");
      const out = await postJson("/api/admin/storage/drive/verify", drivePayload);
      setMsg(out?.message || "Drive OK");
    } catch (e: any) {
      setMsg(`Error: ${e?.message || e}`);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      {msg ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">{msg}</div>
      ) : null}

      <form action="/api/admin/storage/config" method="post" className="space-y-4">
        <input type="hidden" name="action" value="SET_PENDING" />

        <div className="space-y-3">
          <div className="text-sm font-semibold">R2 Playback A/B (Watch/Player)</div>
          <div className="text-xs text-muted-foreground">
            Optional override. Nếu để trống sẽ fallback sang env (`R2_PUBLIC_BASE_URL_A/B`, `R2_AB_SPLIT_PERCENT`).
            Mọi thay đổi vẫn apply sau 24h.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="r2PublicBaseUrlA">Public base URL A (https)</Label>
              <Input id="r2PublicBaseUrlA" name="r2PublicBaseUrlA" value={r2PublicBaseUrlA} onChange={(e) => setR2PublicBaseUrlA(e.target.value)} placeholder="https://r2-a.example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r2PublicBaseUrlB">Public base URL B (https)</Label>
              <Input id="r2PublicBaseUrlB" name="r2PublicBaseUrlB" value={r2PublicBaseUrlB} onChange={(e) => setR2PublicBaseUrlB(e.target.value)} placeholder="https://r2-b.example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r2AbSplitPercent">A split percent (0-100)</Label>
              <Input id="r2AbSplitPercent" name="r2AbSplitPercent" type="number" value={r2AbSplitPercent} onChange={(e) => setR2AbSplitPercent(e.target.value)} placeholder="50" />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="text-sm font-semibold">FTP Origin (MP4 gốc)</div>
          <div className="flex items-center gap-3">
            <Checkbox id="ftpOriginEnabled" name="ftpOriginEnabled" checked={ftpOriginEnabled} onCheckedChange={(v) => setFtpOriginEnabled(Boolean(v))} />
            <Label htmlFor="ftpOriginEnabled" className="cursor-pointer">Enabled</Label>

            <div className="ml-6 flex items-center gap-3">
              <Checkbox id="ftpOriginUploadEnabled" name="ftpOriginUploadEnabled" checked={ftpOriginUploadEnabled} onCheckedChange={(v) => setFtpOriginUploadEnabled(Boolean(v))} />
              <Label htmlFor="ftpOriginUploadEnabled" className="cursor-pointer">Upload MP4 origin</Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ftpOriginHost">Host</Label>
              <Input id="ftpOriginHost" name="ftpOriginHost" value={ftpOriginHost} onChange={(e) => setFtpOriginHost(e.target.value)} placeholder="ftp.example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ftpOriginPort">Port</Label>
              <Input id="ftpOriginPort" name="ftpOriginPort" type="number" value={ftpOriginPort} onChange={(e) => setFtpOriginPort(Number(e.target.value || 21))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ftpOriginUsername">Username</Label>
              <Input id="ftpOriginUsername" name="ftpOriginUsername" value={ftpOriginUsername} onChange={(e) => setFtpOriginUsername(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ftpOriginPassword">Password (only when changing)</Label>
              <Input id="ftpOriginPassword" name="ftpOriginPassword" value={ftpOriginPassword} onChange={(e) => setFtpOriginPassword(e.target.value)} type="password" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ftpOriginBasePath">Remote base path</Label>
              <Input id="ftpOriginBasePath" name="ftpOriginBasePath" value={ftpOriginBasePath} onChange={(e) => setFtpOriginBasePath(e.target.value)} placeholder="/videoshare" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ftpOriginPublicBaseUrl">Public base URL (optional)</Label>
              <Input id="ftpOriginPublicBaseUrl" name="ftpOriginPublicBaseUrl" value={ftpOriginPublicBaseUrl} onChange={(e) => setFtpOriginPublicBaseUrl(e.target.value)} placeholder="https://ftp-origin-cdn.example.com" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy!==""} onClick={() => verifyFtp("origin")}>Verify FTP Origin</Button>
            <Button type="button" variant="secondary" disabled={busy!==""} onClick={() => testUploadFtp("origin")}>Test upload FTP Origin</Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="text-sm font-semibold">FTP HLS (fallback playback)</div>
          <div className="flex items-center gap-3">
            <Checkbox id="ftpHlsEnabled" name="ftpHlsEnabled" checked={ftpHlsEnabled} onCheckedChange={(v) => setFtpHlsEnabled(Boolean(v))} />
            <Label htmlFor="ftpHlsEnabled" className="cursor-pointer">Enabled</Label>

            <div className="ml-6 flex items-center gap-3">
              <Checkbox id="ftpHlsUploadEnabled" name="ftpHlsUploadEnabled" checked={ftpHlsUploadEnabled} onCheckedChange={(v) => setFtpHlsUploadEnabled(Boolean(v))} />
              <Label htmlFor="ftpHlsUploadEnabled" className="cursor-pointer">Upload HLS mirror</Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ftpHlsHost">Host</Label>
              <Input id="ftpHlsHost" name="ftpHlsHost" value={ftpHlsHost} onChange={(e) => setFtpHlsHost(e.target.value)} placeholder="ftp.example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ftpHlsPort">Port</Label>
              <Input id="ftpHlsPort" name="ftpHlsPort" type="number" value={ftpHlsPort} onChange={(e) => setFtpHlsPort(Number(e.target.value || 21))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ftpHlsUsername">Username</Label>
              <Input id="ftpHlsUsername" name="ftpHlsUsername" value={ftpHlsUsername} onChange={(e) => setFtpHlsUsername(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ftpHlsPassword">Password (only when changing)</Label>
              <Input id="ftpHlsPassword" name="ftpHlsPassword" value={ftpHlsPassword} onChange={(e) => setFtpHlsPassword(e.target.value)} type="password" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ftpHlsBasePath">Remote base path</Label>
              <Input id="ftpHlsBasePath" name="ftpHlsBasePath" value={ftpHlsBasePath} onChange={(e) => setFtpHlsBasePath(e.target.value)} placeholder="/videoshare" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ftpHlsPublicBaseUrl">Public base URL (required if enabled)</Label>
              <Input id="ftpHlsPublicBaseUrl" name="ftpHlsPublicBaseUrl" value={ftpHlsPublicBaseUrl} onChange={(e) => setFtpHlsPublicBaseUrl(e.target.value)} placeholder="https://ftp-hls-cdn.example.com" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy!==""} onClick={() => verifyFtp("hls")}>Verify FTP HLS</Button>
            <Button type="button" variant="secondary" disabled={busy!==""} onClick={() => testUploadFtp("hls")}>Test upload FTP HLS</Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="text-sm font-semibold">Google Drive (origin backup)</div>
          <div className="flex items-center gap-3">
            <Checkbox id="driveEnabled" name="driveEnabled" checked={driveEnabled} onCheckedChange={(v) => setDriveEnabled(Boolean(v))} />
            <Label htmlFor="driveEnabled" className="cursor-pointer">Enabled</Label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="driveFolderId">Drive folderId</Label>
            <Input id="driveFolderId" name="driveFolderId" value={driveFolderId} onChange={(e) => setDriveFolderId(e.target.value)} placeholder="1abcDEF..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="driveServiceAccountJson">Service Account JSON (only when changing)</Label>
            <Textarea id="driveServiceAccountJson" name="driveServiceAccountJson" rows={10} value={driveServiceAccountJson} onChange={(e) => setDriveServiceAccountJson(e.target.value)} placeholder='{ "type": "service_account", ... }' />
            <div className="text-xs text-zinc-500">
              JSON sẽ được mã hoá bằng APP_ENCRYPTION_KEY và lưu DB.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy!==""} onClick={() => verifyDrive()}>Verify Drive</Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit">Schedule apply in 24h</Button>
        </div>
      </form>

      {hasPending ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
          <div className="text-sm font-semibold">Pending change</div>
          <div className="text-sm">Apply after: <span className="font-medium">{pendingApplyAt}</span></div>
          <div className="flex flex-wrap gap-2">
            <form action="/api/admin/storage/config" method="post">
              <input type="hidden" name="action" value="CANCEL_PENDING" />
              <Button variant="secondary" type="submit">Cancel pending</Button>
            </form>
            <form action="/api/admin/storage/config" method="post">
              <input type="hidden" name="action" value="APPLY_PENDING" />
              <Button variant="secondary" type="submit">Apply now (if due)</Button>
            </form>
            <a href="/admin/storage/events" className="text-sm underline ml-auto">View audit events</a>
          </div>
        </div>
      ) : (
        <div className="text-sm text-zinc-500">No pending change. <a href="/admin/storage/events" className="underline">View audit events</a></div>
      )}

      <div className="text-xs text-zinc-500">
        Lưu ý: password/service account JSON chỉ cần nhập khi muốn thay đổi. Nếu để trống, hệ thống sẽ giữ secret hiện tại.
      </div>
    </div>
  );
}
