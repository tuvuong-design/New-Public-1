"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Pkg = {
  id: string;
  name: string;
  chain: string;
  expectedAmount: string;
  stars: number;
  bonusStars: number;
  bundleLabel: string | null;
  active: boolean;
  sort: number;
  token?: { symbol: string } | null;
};

export default function BundlesClient({ initialPackages }: { initialPackages: Pkg[] }) {
  const [rows, setRows] = useState<Pkg[]>(initialPackages);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((p) => (p.name + " " + p.chain + " " + (p.token?.symbol || "") + " " + (p.bundleLabel || "")).toLowerCase().includes(s));
  }, [rows, q]);

  async function save(pkg: Pkg) {
    setErr(null);
    setOk(null);
    setSavingId(pkg.id);
    try {
      const res = await fetch("/api/admin/payments/bundles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          packageId: pkg.id,
          bonusStars: Math.max(0, Math.trunc(Number(pkg.bonusStars) || 0)),
          bundleLabel: pkg.bundleLabel ?? null,
          active: pkg.active,
          sort: Math.trunc(Number(pkg.sort) || 0),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "SAVE_FAILED");
      const updated = j.package as Pkg;
      setRows((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      setOk("Saved");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search packages..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        {ok ? <span className="text-sm text-green-600">{ok}</span> : null}
        {err ? <span className="text-sm text-red-600">{err}</span> : null}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package</TableHead>
              <TableHead>Chain</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Base Stars</TableHead>
              <TableHead>Bonus</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Sort</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.token?.symbol ? `${p.token.symbol} • ` : ""}{p.id}</div>
                </TableCell>
                <TableCell>{p.chain}</TableCell>
                <TableCell>{p.expectedAmount} {p.token?.symbol || ""}</TableCell>
                <TableCell>{p.stars}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={p.bonusStars ?? 0}
                    onChange={(e) => setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, bonusStars: Number(e.target.value) } : x)))}
                    className="w-28"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={p.bundleLabel || ""}
                    onChange={(e) => setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, bundleLabel: e.target.value || null } : x)))}
                    className="w-48"
                    placeholder="e.g. New Year"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={Boolean(p.active)}
                    onChange={(e) => setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: e.target.checked } : x)))}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={p.sort ?? 0}
                    onChange={(e) => setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, sort: Number(e.target.value) } : x)))}
                    className="w-24"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="secondary" size="sm" onClick={() => save(p)} disabled={savingId === p.id}>
                    {savingId === p.id ? "Saving..." : "Save"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Bundle bonus is credited as a separate ledger tx: type=BUNDLE_BONUS (depositId+type idempotent). Labels are shown on /stars/topup.
      </div>
    </div>
  );
}
