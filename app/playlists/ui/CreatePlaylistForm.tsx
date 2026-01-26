"use client";

import { useState } from "react";

export default function CreatePlaylistForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">("PRIVATE");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setMsg(null);
    const t = title.trim();
    if (!t) {
      setMsg("Nhập tiêu đề");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: t, description: description.trim() || null, visibility }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const id = data?.playlist?.id;
      if (id) window.location.href = `/p/${id}`;
      else window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 800 }}>Create playlist</div>
      <div className="small muted">Lưu video để xem lại hoặc chia sẻ.</div>
      <div className="space-y-2" style={{ marginTop: 10 }}>
        <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="textarea"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <div className="small muted">Visibility</div>
          <select className="select" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
            <option value="PRIVATE">PRIVATE</option>
            <option value="UNLISTED">UNLISTED</option>
            <option value="PUBLIC">PUBLIC</option>
          </select>
          <button className="btn btn-primary" disabled={busy} onClick={create}>
            {busy ? "Creating..." : "Create"}
          </button>
        </div>
        {msg ? <div className="small" style={{ color: "#b91c1c" }}>{msg}</div> : null}
      </div>
    </div>
  );
}
