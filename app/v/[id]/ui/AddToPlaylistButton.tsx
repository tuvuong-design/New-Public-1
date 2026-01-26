"use client";

import { useEffect, useMemo, useState } from "react";

type PlaylistRow = { id: string; title: string; visibility: string; _count?: { items: number } };

export default function AddToPlaylistButton({ videoId, disabled }: { videoId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/playlists")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const list: PlaylistRow[] = d?.playlists ?? [];
        setPlaylists(list);
        if (!selected && list[0]?.id) setSelected(list[0].id);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canAdd = useMemo(() => Boolean(selected || newTitle.trim()), [selected, newTitle]);

  async function createAndSelect() {
    const t = newTitle.trim();
    if (!t) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: t, visibility: "PRIVATE" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const id = data?.playlist?.id;
      if (id) {
        setSelected(id);
        setPlaylists([{ id, title: t, visibility: "PRIVATE" }, ...playlists]);
        setNewTitle("");
      }
    } catch (e: any) {
      setMsg(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!canAdd) return;
    setBusy(true);
    setMsg(null);
    try {
      let pid = selected;
      if (!pid && newTitle.trim()) {
        await createAndSelect();
        // pid will be updated via state; small delay
        pid = selected;
      }
      if (!pid) throw new Error("Choose playlist");

      const res = await fetch(`/api/playlists/${pid}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg("Added!");
      setTimeout(() => setOpen(false), 700);
    } catch (e: any) {
      setMsg(e?.message || "Add failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        title="Add to playlist"
      >
        + Playlist
      </button>

      {open ? (
        <div
          className="card"
          style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, zIndex: 20 }}
        >
          <div style={{ fontWeight: 800 }}>Add to playlist</div>
          <div className="small muted">Chọn playlist hoặc tạo nhanh.</div>

          <div style={{ marginTop: 10 }} className="space-y-2">
            <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">-- Select --</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.visibility})
                </option>
              ))}
            </select>

            <div className="small muted">Or create new</div>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <input
                className="input"
                placeholder="New playlist title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button className="btn" disabled={busy || !newTitle.trim()} onClick={createAndSelect}>
                Create
              </button>
            </div>

            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" disabled={busy} onClick={() => setOpen(false)}>
                Close
              </button>
              <button className="btn btn-primary" disabled={busy || !canAdd} onClick={add}>
                {busy ? "..." : "Add"}
              </button>
            </div>

            {msg ? <div className="small muted">{msg}</div> : null}
            <div className="small">
              <a href="/playlists" style={{ textDecoration: "underline" }}>
                Manage playlists
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
