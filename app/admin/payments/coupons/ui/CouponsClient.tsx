"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Coupon = {
  id: string;
  code: string;
  kind: "PERCENT" | "FIXED";
  value: number;
  appliesTo: "ANY" | "TOPUP" | "SEASON_PASS";
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptionsTotal: number | null;
  maxRedemptionsPerUser: number | null;
  note: string | null;
  updatedAt: string;
  createdAt: string;
};

type FormState = {
  id?: string;
  code: string;
  kind: "PERCENT" | "FIXED";
  value: number;
  appliesTo: "ANY" | "TOPUP" | "SEASON_PASS";
  active: boolean;
  startsAt: string;
  endsAt: string;
  maxRedemptionsTotal: string;
  maxRedemptionsPerUser: string;
  note: string;
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeCode(code: string): string {
  return (code || "").trim().toUpperCase();
}

export default function CouponsClient({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [items, setItems] = useState<Coupon[]>(initialCoupons as any);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    code: "",
    kind: "PERCENT",
    value: 10,
    appliesTo: "ANY",
    active: true,
    startsAt: "",
    endsAt: "",
    maxRedemptionsTotal: "",
    maxRedemptionsPerUser: "",
    note: "",
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => (c.code + " " + (c.note || "") + " " + c.appliesTo).toLowerCase().includes(s));
  }, [items, q]);

  function loadToForm(c: Coupon) {
    setForm({
      id: c.id,
      code: c.code,
      kind: c.kind,
      value: Number(c.value || 0),
      appliesTo: c.appliesTo,
      active: Boolean(c.active),
      startsAt: toLocalInputValue(c.startsAt),
      endsAt: toLocalInputValue(c.endsAt),
      maxRedemptionsTotal: c.maxRedemptionsTotal == null ? "" : String(c.maxRedemptionsTotal),
      maxRedemptionsPerUser: c.maxRedemptionsPerUser == null ? "" : String(c.maxRedemptionsPerUser),
      note: c.note || "",
    });
  }

  function resetForm() {
    setForm({
      code: "",
      kind: "PERCENT",
      value: 10,
      appliesTo: "ANY",
      active: true,
      startsAt: "",
      endsAt: "",
      maxRedemptionsTotal: "",
      maxRedemptionsPerUser: "",
      note: "",
    });
  }

  async function refresh() {
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/payments/coupons", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "LOAD_FAILED");
      setItems(j.coupons);
      setOk("Refreshed");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      const payload: any = {
        id: form.id,
        code: normalizeCode(form.code),
        kind: form.kind,
        value: Math.max(1, Math.trunc(Number(form.value) || 0)),
        appliesTo: form.appliesTo,
        active: Boolean(form.active),
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        maxRedemptionsTotal: form.maxRedemptionsTotal ? Math.max(0, Math.trunc(Number(form.maxRedemptionsTotal) || 0)) : null,
        maxRedemptionsPerUser: form.maxRedemptionsPerUser ? Math.max(0, Math.trunc(Number(form.maxRedemptionsPerUser) || 0)) : null,
        note: form.note || null,
      };
      const res = await fetch("/api/admin/payments/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "SAVE_FAILED");
      const saved: Coupon = j.coupon;
      setItems((prev) => {
        const exists = prev.find((x) => x.id === saved.id);
        if (exists) return prev.map((x) => (x.id === saved.id ? saved : x));
        return [saved, ...prev];
      });
      setOk(form.id ? "Updated" : "Created");
      resetForm();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete coupon?")) return;
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payments/coupons/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "DELETE_FAILED");
      setItems((prev) => prev.filter((c) => c.id !== id));
      setOk("Deleted");
      if (form.id === id) resetForm();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search coupons..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Button variant="secondary" size="sm" onClick={refresh} disabled={busy}>Refresh</Button>
        {ok ? <span className="text-sm text-green-600">{ok}</span> : null}
        {err ? <span className="text-sm text-red-600">{err}</span> : null}
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="font-semibold">{form.id ? "Edit coupon" : "Create coupon"}</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Code</Label>
            <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="VIP10" />
            <div className="text-xs text-muted-foreground">Allowed: A-Z 0-9 _ -</div>
          </div>

          <div className="space-y-1">
            <Label>Applies to</Label>
            <Select value={form.appliesTo} onValueChange={(v) => setForm((p) => ({ ...p, appliesTo: v as any }))}>
              <SelectTrigger><SelectValue placeholder="Applies to" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">ANY</SelectItem>
                <SelectItem value="TOPUP">TOPUP (bonus stars)</SelectItem>
                <SelectItem value="SEASON_PASS">SEASON_PASS (discount)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Kind</Label>
            <Select value={form.kind} onValueChange={(v) => setForm((p) => ({ ...p, kind: v as any }))}>
              <SelectTrigger><SelectValue placeholder="Kind" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">PERCENT</SelectItem>
                <SelectItem value="FIXED">FIXED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Value</Label>
            <Input type="number" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: Number(e.target.value) }))} />
            <div className="text-xs text-muted-foreground">PERCENT = %; FIXED = stars amount.</div>
          </div>

          <div className="space-y-1">
            <Label>Starts at (optional)</Label>
            <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Ends at (optional)</Label>
            <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))} />
          </div>

          <div className="space-y-1">
            <Label>Max total redemptions (optional)</Label>
            <Input value={form.maxRedemptionsTotal} onChange={(e) => setForm((p) => ({ ...p, maxRedemptionsTotal: e.target.value }))} placeholder="" />
          </div>
          <div className="space-y-1">
            <Label>Max per user (optional)</Label>
            <Input value={form.maxRedemptionsPerUser} onChange={(e) => setForm((p) => ({ ...p, maxRedemptionsPerUser: e.target.value }))} placeholder="" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
          <span className="text-sm">Active</span>
        </div>

        <div className="space-y-1">
          <Label>Note</Label>
          <Textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Internal note" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy}>{busy ? "Saving..." : (form.id ? "Update" : "Create")}</Button>
          <Button variant="secondary" onClick={resetForm} disabled={busy}>Clear</Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Applies</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Limits</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.code}</div>
                  <div className="text-xs text-muted-foreground">{c.id}</div>
                </TableCell>
                <TableCell>{c.appliesTo}</TableCell>
                <TableCell>{c.kind}</TableCell>
                <TableCell>{c.value}</TableCell>
                <TableCell>{c.active ? "Yes" : "No"}</TableCell>
                <TableCell className="text-xs">
                  {c.startsAt ? new Date(c.startsAt).toLocaleString() : "-"}
                  <br />
                  {c.endsAt ? new Date(c.endsAt).toLocaleString() : "-"}
                </TableCell>
                <TableCell className="text-xs">
                  total: {c.maxRedemptionsTotal ?? "-"}
                  <br />
                  user: {c.maxRedemptionsPerUser ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => loadToForm(c)} disabled={busy}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(c.id)} disabled={busy}>Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        <div><b>Topup:</b> coupon adds bonus stars at credit time (worker reconcile) → ledger type=COUPON_BONUS, discountReason=COUPON:CODE.</div>
        <div><b>Season Pass:</b> coupon discounts stars price at purchase time → purchase stores original/discount/final fields, and redemption is recorded.</div>
      </div>
    </div>
  );
}
