"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type ChannelOpt = { id: string; name: string; slug: string };

type ApiSourceRow = {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  prefix: string;
  createdAt: string;
  channelId: string | null;
  channel: ChannelOpt | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  mappingJson: string;
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString();
}

function detectKindLabel(url: string) {
  const u = url.toLowerCase();
  if (u.includes("peertube") || u.includes("/api/v1/")) return "PeerTube";
  return "Zone3s";
}

export function ChannelSyncPage({ channels }: { channels: ChannelOpt[] }) {
  const [items, setItems] = useState<ApiSourceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // create form state
  const [url, setUrl] = useState("https://test.zone3s.com/themes/api-posts_mysqli.php");
  const [channelId, setChannelId] = useState<string>("__none__");
  const [newChannelName, setNewChannelName] = useState("");
  const [mode, setMode] = useState<"IMPORT_ALL" | "NEW_ONLY">("IMPORT_ALL");
  const [enabled, setEnabled] = useState(true);

  async function refresh() {
    const res = await fetch("/api/me/sync-sources", { cache: "no-store" });
    const js = await res.json();
    if (js?.ok) setItems(js.items);
  }

  useEffect(() => {
    refresh();
  }, []);

  const channelSelectItems = useMemo(() => {
    const out = [...channels].sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [channels]);

  async function create() {
    setLoading(true);
    try {
      const res = await fetch("/api/me/sync-sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, channelId, newChannelName, existingMode: mode, enabled }),
      });
      const js = await res.json();
      if (!js?.ok) {
        alert(js?.error || "Create failed");
        return;
      }
      setCreateOpen(false);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function run(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/me/sync-sources/${id}/run`, { method: "POST" });
      const js = await res.json();
      if (!js?.ok) alert(js?.error || "Run failed");
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function toggle(id: string, v: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/me/sync-sources/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: v }),
      });
      const js = await res.json();
      if (!js?.ok) alert(js?.error || "Update failed");
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Xóa cấu hình đồng bộ này? (Không xóa video đã nhập)") ) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/me/sync-sources/${id}`, { method: "DELETE" });
      const js = await res.json();
      if (!js?.ok) alert(js?.error || "Delete failed");
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-extrabold">Đồng bộ hóa</div>
          <div className="text-sm text-muted-foreground">
            Kết nối PeerTube hoặc API PHP (Zone3s) để nhập video về kênh của bạn. Bạn vẫn có thể xóa video trong Studio / Admin.
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={loading}>
          + Thêm đồng bộ hóa
        </Button>
      </div>

      {/* Create modal (PeerTube-ish) */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-3 md:p-8">
          <div className="w-full max-w-[760px] rounded-2xl bg-white shadow-xl border overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-extrabold">ĐỒNG BỘ HÓA MỚI</div>
              <button className="text-neutral-600 hover:text-neutral-900" onClick={() => setCreateOpen(false)}>
                ✕
              </button>
            </div>
            <div className="p-4 grid gap-4">
              <div className="grid gap-2">
                <Label>URL kênh từ xa</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
                <div className="text-xs text-muted-foreground">Tự nhận diện: {detectKindLabel(url)}</div>
              </div>

              <div className="grid gap-2">
                <Label>Kênh video</Label>
                <Select value={channelId} onValueChange={(v) => setChannelId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn kênh (tùy chọn)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(Không đặt kênh)</SelectItem>
                    <SelectItem value="__new__">+ Tạo kênh mới…</SelectItem>
                    {channelSelectItems.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {channelId === "__new__" && (
                  <Input
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="Tên kênh mới"
                  />
                )}
              </div>

              <div className="grid gap-2">
                <Label>Đối với các video đang có trên kênh từ xa</Label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={mode === "IMPORT_ALL"} onChange={() => setMode("IMPORT_ALL")} />
                  Nhập tất cả và luôn lấy các video mới
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={mode === "NEW_ONLY"} onChange={() => setMode("NEW_ONLY")} />
                  Chỉ lấy các video mới
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
                <span className="text-sm">Bật đồng bộ</span>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={loading}>
                  Hủy
                </Button>
                <Button onClick={create} disabled={loading || !url.trim()}>
                  Tạo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="card p-6 text-center">
          <div className="font-bold">Chưa có đồng bộ</div>
          <div className="text-sm text-muted-foreground mt-1">Bạn chưa cấu hình đồng bộ hóa kênh.</div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Kênh bên ngoài</th>
                  <th className="p-3 font-semibold">Kênh</th>
                  <th className="p-3 font-semibold">Trạng thái</th>
                  <th className="p-3 font-semibold">Đã tạo</th>
                  <th className="p-3 font-semibold">Đồng bộ lần cuối</th>
                  <th className="p-3 font-semibold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground break-all">{s.baseUrl}</div>
                    </td>
                    <td className="p-3">{s.channel ? s.channel.name : "—"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${s.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-neutral-50 text-neutral-700 border-neutral-200"}`}>
                          {s.enabled ? "Đang bật" : "Đã tắt"}
                        </span>
                        {s.lastSyncStatus ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${s.lastSyncStatus === "OK" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                            {s.lastSyncStatus}
                          </span>
                        ) : null}
                      </div>
                      {s.lastSyncStatus === "ERROR" && s.lastSyncError ? (
                        <div className="text-xs text-red-700 mt-1 line-clamp-2">{s.lastSyncError}</div>
                      ) : null}
                    </td>
                    <td className="p-3">{fmtDate(s.createdAt)}</td>
                    <td className="p-3">{fmtDate(s.lastSyncAt)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        <button className="text-xs underline" onClick={() => toggle(s.id, !s.enabled)} disabled={loading}>
                          {s.enabled ? "Tắt" : "Bật"}
                        </button>
                        <button className="text-xs underline" onClick={() => run(s.id)} disabled={loading || !s.enabled}>
                          Đồng bộ
                        </button>
                        <button className="text-xs underline text-red-700" onClick={() => del(s.id)} disabled={loading}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Gợi ý PeerTube: nếu bạn dán URL dạng <span className="font-mono">/videos/browse</span> hệ thống sẽ tự chuyển sang API <span className="font-mono">/api/v1/videos</span> để đồng bộ.
      </div>
    </div>
  );
}
