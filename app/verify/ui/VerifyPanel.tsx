"use client";

import { useState } from "react";

type Check = { ok: boolean; message: string; latencyMs: number };
type Res =
  | { ok: false; configured: false; message: string }
  | { ok: boolean; configured: true; checks: { db: Check; redis: Check; r2: Check }; tip: string };

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

export default function VerifyPanel() {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Res | null>(null);

  async function run() {
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/verify", { cache: "no-store" });
      const data = (await r.json()) as Res;
      setRes(data);
    } catch (e: any) {
      setRes({ ok: false, configured: false, message: e?.message || "Verify failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <b>System checks</b>
        <button onClick={run} disabled={loading}>
          {loading ? "Running..." : "Run verify"}
        </button>
      </div>

      {!res ? (
        <p className="small muted" style={{ marginTop: 8 }}>
          Bấm <b>Run verify</b> để kiểm tra DB / Redis / R2 bằng env hiện tại.
        </p>
      ) : null}

      {res && !("checks" in res) ? (
        <div style={{ marginTop: 10 }}>
          <Badge ok={false} />{" "}
          <span className="small">{res.message}</span>
        </div>
      ) : null}

      {res && "checks" in res ? (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <Row name="Database" c={res.checks.db} />
          <Row name="Redis" c={res.checks.redis} />
          <Row name="Cloudflare R2" c={res.checks.r2} />

          <div className="card" style={{ background: "#fafafa" }}>
            <b>Result</b>
            <div className="small muted" style={{ marginTop: 6 }}>
              Tổng: <Badge ok={res.ok} /> — {res.tip}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ name, c }: { name: string; c: Check }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <div style={{ minWidth: 140, fontWeight: 700 }}>{name}</div>
      <div className="small" style={{ flex: 1 }}>
        {c.message} {c.latencyMs ? <span className="muted">({c.latencyMs}ms)</span> : null}
      </div>
      <Badge ok={c.ok} />
    </div>
  );
}
