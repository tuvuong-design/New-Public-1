"use client";

import Link from "next/link";
import SensitiveThumb from "@/components/sensitive/SensitiveThumb";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useMemo, useState } from "react";

export default function PlaylistItemsGrid({
  playlistId,
  items,
  canEdit,
  canSeeUnpublished,
  sensitiveMode,
}: {
  playlistId: string;
  items: Array<{ id: string; sort: number; video: any }>; // pre-serialized
  canEdit: boolean;
  canSeeUnpublished: boolean;
  sensitiveMode: any;
}) {
  const initial = useMemo(() => [...items].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)), [items]);
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function remove(itemId: string) {
    await fetch(`/api/playlists/${playlistId}/items`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId }),
    }).catch(() => null);
    window.location.reload();
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...order];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;
    setOrder(next);
  }

  const visible = order.filter((it) => {
    const v = it.video;
    if (!v) return false;
    if (v.status === "DELETED") return false;
    if (v.status !== "PUBLISHED" && !canSeeUnpublished) return false;
    return true;
  });

  const changed = visible.length === initial.length && visible.some((it, idx) => it.id !== initial[idx]?.id);

  async function saveOrder() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/reorder`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemIds: visible.map((x) => x.id) }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg("Order saved");
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (visible.length === 0) {
    return <div className="small muted">Chưa có video trong playlist.</div>;
  }

  return (
    <div className="space-y-3">
      {canEdit && changed ? (
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="small muted">Đã thay đổi thứ tự.</div>
          <button className="btn btn-primary" disabled={busy} onClick={saveOrder}>
            {busy ? "Saving..." : "Save order"}
          </button>
        </div>
      ) : null}
      {msg ? <div className="small muted">{msg}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {visible.map((it, idx) => {
          const v = it.video;
          return (
            <div key={it.id} className="card">
              <Link href={`/v/${v.id}?list=${encodeURIComponent(playlistId)}`}>
                <div style={{ fontWeight: 900 }}>{v.title}</div>
                <div className="small muted">
                  {v.viewCount} views • {v.likeCount} likes • {v.starCount} stars
                </div>
                <div
                  style={{
                    marginTop: 10,
                    aspectRatio: "16/9",
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "#f3f3f3",
                  }}
                >
                  <SensitiveThumb
                    src={resolveMediaUrl(v.thumbKey)}
                    alt={v.title}
                    isSensitive={Boolean(v.isSensitive)}
                    mode={sensitiveMode}
                  />
                </div>
              </Link>

              {canEdit ? (
                <div className="row" style={{ justifyContent: "space-between", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn" onClick={() => move(idx, -1)} disabled={busy || idx === 0}>
                      ↑
                    </button>
                    <button className="btn" onClick={() => move(idx, 1)} disabled={busy || idx === visible.length - 1}>
                      ↓
                    </button>
                  </div>
                  <button className="btn" onClick={() => remove(it.id)} disabled={busy}>
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
