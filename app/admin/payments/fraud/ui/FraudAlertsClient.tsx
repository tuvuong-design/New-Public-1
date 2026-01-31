"use client";

import { useEffect, useMemo, useState } from "react";

type FraudAlert = {
  id: string;
  kind: string;
  severity: string;
  status: string;
  title: string;
  message?: string | null;
  dedupeKey: string;
  createdAt: string;
  user?: { id: string; email?: string | null } | null;
  deposit?: { id: string; chain: string; status: string; txHash?: string | null } | null;
  acknowledgedBy?: { id: string; email?: string | null } | null;
  resolvedBy?: { id: string; email?: string | null } | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
};

function fmtDt(s: string | null | undefined) {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return String(s);
  }
}

async function post(url: string, body: any) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    let msg = "REQUEST_FAILED";
    try { const j = await res.json(); msg = j?.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export default function FraudAlertsClient({
  initial,
}: {
  initial: { status?: string; kind?: string; severity?: string; q?: string; page?: string };
}) {
  const [status, setStatus] = useState((initial.status || "OPEN").toUpperCase());
  const [kind, setKind] = useState(initial.kind || "");
  const [severity, setSeverity] = useState(initial.severity || "");
  const [q, setQ] = useState(initial.q || "");
  const [page, setPage] = useState(Number(initial.page || 1));

  const [items, setItems] = useState<FraudAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qp = useMemo(() => {
    const p = new URLSearchParams();
    p.set("status", status);
    if (kind) p.set("kind", kind);
    if (severity) p.set("severity", severity);
    if (q) p.set("q", q);
    p.set("page", String(page));
    p.set("pageSize", "25");
    return p.toString();
  }, [status, kind, severity, q, page]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/payments/fraud/alerts?${qp}`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "FAILED");
        if (cancelled) return;
        setItems(j.items || []);
        setTotal(Number(j.total || 0));
      } catch (e: any) {
        if (cancelled) return;
        setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [qp]);

  const pages = Math.max(1, Math.ceil(total / 25));

  async function ack(id: string) {
    await post("/api/admin/payments/fraud/alerts/ack", { id });
    // refresh
    setPage(1);
  }

  async function resolve(id: string) {
    await post("/api/admin/payments/fraud/alerts/resolve", { id });
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Status</div>
          <select className="h-9 rounded-md border px-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="OPEN">OPEN</option>
            <option value="ACKED">ACKED</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Severity</div>
          <select className="h-9 rounded-md border px-2 text-sm" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Kind</div>
          <select className="h-9 rounded-md border px-2 text-sm" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="DUP_TX_HASH">DUP_TX_HASH</option>
            <option value="TOPUP_RATE_LIMIT">TOPUP_RATE_LIMIT</option>
            <option value="MANUAL_CREDIT_LARGE">MANUAL_CREDIT_LARGE</option>
            <option value="WEBHOOK_FAIL_SPIKE">WEBHOOK_FAIL_SPIKE</option>
            <option value="NEEDS_REVIEW_BURST">NEEDS_REVIEW_BURST</option>
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[220px]">
          <div className="text-xs text-muted-foreground">Search (email / txHash / text)</div>
          <input className="h-9 w-full rounded-md border px-2 text-sm" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setPage(1); }} placeholder="e.g. user@email.com or txHash" />
        </div>
        <button className="h-9 rounded-md border px-3 text-sm" onClick={() => setPage(1)} disabled={loading}>Apply</button>
      </div>

      {error ? <div className="rounded-md border p-3 text-sm text-red-600">{error}</div> : null}

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Time</th>
                <th className="p-2">Severity</th>
                <th className="p-2">Kind</th>
                <th className="p-2">Title</th>
                <th className="p-2">User</th>
                <th className="p-2">Deposit</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="p-3" colSpan={8}>Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="p-3" colSpan={8}>No alerts.</td></tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap">{fmtDt(a.createdAt)}</td>
                    <td className="p-2 whitespace-nowrap">{a.severity}</td>
                    <td className="p-2 whitespace-nowrap">{a.kind}</td>
                    <td className="p-2">
                      <div className="font-medium">{a.title}</div>
                      {a.message ? <div className="text-xs text-muted-foreground whitespace-pre-wrap">{a.message}</div> : null}
                      <div className="text-xs text-muted-foreground">dedupeKey: {a.dedupeKey}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap">{a.user?.email || a.user?.id || "-"}</td>
                    <td className="p-2 whitespace-nowrap">
                      {a.deposit ? (
                        <a className="text-blue-600 underline" href={`/admin/payments/deposits/${a.deposit.id}`}>{a.deposit.chain}:{a.deposit.status}</a>
                      ) : "-"}
                      {a.deposit?.txHash ? <div className="text-xs text-muted-foreground break-all max-w-[220px]">{a.deposit.txHash}</div> : null}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div>{a.status}</div>
                      {a.acknowledgedAt ? <div className="text-xs text-muted-foreground">Ack: {fmtDt(a.acknowledgedAt)} {a.acknowledgedBy?.email ? `(${a.acknowledgedBy.email})` : ""}</div> : null}
                      {a.resolvedAt ? <div className="text-xs text-muted-foreground">Res: {fmtDt(a.resolvedAt)} {a.resolvedBy?.email ? `(${a.resolvedBy.email})` : ""}</div> : null}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        {a.status === "OPEN" ? (
                          <button className="h-8 rounded-md border px-2 text-xs" onClick={() => ack(a.id)}>Ack</button>
                        ) : null}
                        {a.status !== "RESOLVED" ? (
                          <button className="h-8 rounded-md border px-2 text-xs" onClick={() => resolve(a.id)}>Resolve</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Total: {total}</div>
        <div className="flex items-center gap-2">
          <button className="h-9 rounded-md border px-3 text-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <div className="text-sm">Page {page} / {pages}</div>
          <button className="h-9 rounded-md border px-3 text-sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next</button>
        </div>
      </div>
    </div>
  );
}
