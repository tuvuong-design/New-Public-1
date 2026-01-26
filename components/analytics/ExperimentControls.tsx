"use client";

import { useState } from "react";

export default function ExperimentControls({
  videoId,
  existingExperiment,
}: {
  videoId: string;
  existingExperiment:
    | {
        id: string;
        status: "DRAFT" | "RUNNING" | "PAUSED" | "ENDED";
      }
    | null;
}) {
  const [title, setTitle] = useState("");
  const [thumbKey, setThumbKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/studio/experiments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, titleB: title || null, thumbKeyB: thumbKey || null }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg("Created. Refreshing...");
        window.location.reload();
      } else {
        setMsg(j?.error || "ERROR");
      }
    } catch (e: any) {
      setMsg(e?.message || "ERROR");
    } finally {
      setLoading(false);
    }
  }

  async function end() {
    if (!existingExperiment) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/studio/experiments/${existingExperiment.id}/end`, { method: "POST" });
      const j = await res.json();
      if (j?.ok) {
        setMsg("Ended. Refreshing...");
        window.location.reload();
      } else {
        setMsg(j?.error || "ERROR");
      }
    } catch (e: any) {
      setMsg(e?.message || "ERROR");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="text-lg font-extrabold">A/B Testing (MVP)</div>
      <div className="small muted mt-1">
        Stable assignment per anonymous viewer cookie <code>vsid</code>. Metrics aggregate into experiment variants.
      </div>

      {existingExperiment ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="text-sm">Current experiment: <span className="font-semibold">{existingExperiment.status}</span></div>
          {existingExperiment.status === "RUNNING" ? (
            <button className="btn btn-muted" type="button" disabled={loading} onClick={end}>
              End experiment
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <div className="text-sm font-semibold">Variant B title (optional)</div>
              <input className="input mt-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Alternative title" />
            </label>
            <label className="block">
              <div className="text-sm font-semibold">Variant B thumbKey (optional)</div>
              <input className="input mt-1 w-full" value={thumbKey} onChange={(e) => setThumbKey(e.target.value)} placeholder="R2 object key (immutable)" />
            </label>
          </div>
          <button className="btn" type="button" disabled={loading} onClick={create}>
            Create & start experiment
          </button>
        </div>
      )}

      {msg ? <div className="mt-3 text-sm">{msg}</div> : null}
    </div>
  );
}
