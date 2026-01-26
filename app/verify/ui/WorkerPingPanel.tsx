"use client";

import { useState } from "react";

type Res =
  | { ok: true; message: string; latencyMs: number; result?: any }
  | { ok: false; message: string; latencyMs: number };

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        border: "1px solid #e5e5e5",
        background: ok ? "rgba(0,200,0,0.08)" : "rgba(200,0,0,0.08)",
      }}
    >
      {ok ? "✅ OK" : "❌ FAIL"}
    </span>
  );
}

export default function WorkerPingPanel() {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Res | null>(null);

  async function run() {
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/verify/worker", { cache: "no-store" });
      const data = (await r.json()) as Res;
      setRes(data);
    } catch (e: any) {
      setRes({ ok: false, message: e?.message || "Worker verify failed", latencyMs: 0 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <b>Worker check (queue ping)</b>
        <button onClick={run} disabled={loading}>
          {loading ? "Pinging..." : "Ping worker"}
        </button>
      </div>

      <p className="small muted" style={{ marginTop: 8 }}>
        Endpoint này enqueue job <code>verify:ping</code> và chờ worker trả <code>pong</code>. Nếu worker không chạy, sẽ timeout.
      </p>

      {res ? (
        <div style={{ marginTop: 10 }} className="row">
          <Badge ok={res.ok} />
          <span className="small">
            {res.message} {res.latencyMs ? <span className="muted">({res.latencyMs}ms)</span> : null}
          </span>
        </div>
      ) : null}

      <div className="small muted" style={{ marginTop: 8 }}>
        Debug JSON:{" "}
        <a href="/api/verify/worker" target="_blank" rel="noreferrer">
          /api/verify/worker
        </a>
      </div>
    </div>
  );
}
