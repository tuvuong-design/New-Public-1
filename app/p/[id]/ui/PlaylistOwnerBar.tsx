"use client";

import { useEffect, useState } from "react";

type Collab = {
  role: "VIEWER" | "EDITOR";
  user: { id: string; name: string | null; username: string | null; email: string | null };
};

export default function PlaylistOwnerBar({
  playlistId,
  initialTitle,
  initialDescription,
  initialVisibility,
  initialIsSeries,
  initialSeriesSlug,
  initialSeriesDescription,
  coverUrl,
}: {
  playlistId: string;
  initialTitle: string;
  initialDescription: string;
  initialVisibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  initialIsSeries: boolean;
  initialSeriesSlug: string;
  initialSeriesDescription: string;
  coverUrl: string | null;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [visibility, setVisibility] = useState(initialVisibility);

  const [isSeries, setIsSeries] = useState(initialIsSeries);
  const [seriesSlug, setSeriesSlug] = useState(initialSeriesSlug);
  const [seriesDescription, setSeriesDescription] = useState(initialSeriesDescription);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // collaborators
  const [collabs, setCollabs] = useState<Collab[]>([]);
  const [inviteKey, setInviteKey] = useState("");
  const [inviteRole, setInviteRole] = useState<"VIEWER" | "EDITOR">("VIEWER");
  const [collabMsg, setCollabMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/playlists/${playlistId}/collaborators`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCollabs((d?.collaborators ?? []).map((x: any) => ({ role: x.role, user: x.user }))))
      .catch(() => {});
  }, [playlistId]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          visibility,
          isSeries,
          seriesSlug: seriesSlug.trim() ? seriesSlug.trim() : null,
          seriesDescription: seriesDescription.trim() ? seriesDescription.trim() : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg("Saved");
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    setCollabMsg(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/collaborators`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usernameOrEmail: inviteKey.trim(), role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "INVITE_FAILED");
      setInviteKey("");
      setCollabMsg("Invited");
      window.location.reload();
    } catch (e: any) {
      setCollabMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function removeCollab(userId: string) {
    if (!confirm("Remove collaborator?")) return;
    setBusy(true);
    setCollabMsg(null);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/collaborators`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCollabMsg("Removed");
      window.location.reload();
    } catch (e: any) {
      setCollabMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadCover(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/playlists/${playlistId}/cover`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      setMsg("Cover uploaded");
      window.location.reload();
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function clearCover() {
    if (!confirm("Remove cover?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/cover`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      window.location.reload();
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <div style={{ fontWeight: 800 }}>Owner controls</div>
        <div className="small muted">Chỉnh title/visibility, cover, series và collaborators.</div>
      </div>

      <div className="space-y-2">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
        <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select className="select" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
            <option value="PRIVATE">PRIVATE</option>
            <option value="UNLISTED">UNLISTED</option>
            <option value="PUBLIC">PUBLIC</option>
          </select>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="card" style={{ background: "#fff" }}>
        <div style={{ fontWeight: 800 }}>Cover image</div>
        <div className="small muted">Upload cover (<= 2MB). R2 key immutable.</div>
        {coverUrl ? (
          <div className="row" style={{ marginTop: 8, gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <a className="text-sm underline" href={coverUrl} target="_blank" rel="noreferrer">Open cover</a>
            <button className="btn" onClick={clearCover} disabled={busy}>Remove</button>
          </div>
        ) : null}
        <div style={{ marginTop: 8 }}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadCover(f);
            }}
          />
        </div>
      </div>

      <div className="card" style={{ background: "#fff" }}>
        <div style={{ fontWeight: 800 }}>Series</div>
        <div className="small muted">Bật series để có landing page /series/[slug].</div>
        <label className="row" style={{ gap: 8, alignItems: "center", marginTop: 8 }}>
          <input type="checkbox" checked={isSeries} onChange={(e) => setIsSeries(e.target.checked)} />
          <span>Is series</span>
        </label>
        <div className="space-y-2" style={{ marginTop: 8 }}>
          <input className="input" value={seriesSlug} onChange={(e) => setSeriesSlug(e.target.value)} placeholder="series-slug (a-z0-9-)" />
          <textarea className="textarea" value={seriesDescription} onChange={(e) => setSeriesDescription(e.target.value)} placeholder="Series description" />
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          Lưu ý: slug unique. Nếu để trống → seriesSlug=null.
        </div>
      </div>

      <div className="card" style={{ background: "#fff" }}>
        <div style={{ fontWeight: 800 }}>Collaborators</div>
        <div className="small muted">Mời bằng username/email. EDITOR có thể add/remove/reorder items & upload cover.</div>

        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input className="input" value={inviteKey} onChange={(e) => setInviteKey(e.target.value)} placeholder="username or email" style={{ minWidth: 220 }} />
          <select className="select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
            <option value="VIEWER">VIEWER</option>
            <option value="EDITOR">EDITOR</option>
          </select>
          <button className="btn btn-primary" disabled={busy || !inviteKey.trim()} onClick={invite}>
            Invite
          </button>
        </div>

        {collabMsg ? <div className="small muted" style={{ marginTop: 8 }}>{collabMsg}</div> : null}

        <div className="space-y-2" style={{ marginTop: 10 }}>
          {collabs.length === 0 ? <div className="small muted">No collaborators.</div> : null}
          {collabs.map((c) => (
            <div key={c.user.id} className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div className="small">
                <b>{c.user.name ?? c.user.username ?? c.user.email ?? c.user.id}</b> • {c.role}
              </div>
              <button className="btn" disabled={busy} onClick={() => removeCollab(c.user.id)}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      {msg ? <div className="small muted">{msg}</div> : null}
    </div>
  );
}
