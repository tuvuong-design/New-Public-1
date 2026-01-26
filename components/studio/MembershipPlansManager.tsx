"use client";

import { useEffect, useState } from "react";

type Plan = {
  id: string;
  title: string;
  starsPrice: number;
  durationDays: number;
  benefits?: string | null;
  isActive: boolean;
};

export function MembershipPlansManager({ initialPlans }: { initialPlans: Plan[] }) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans || []);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [starsPrice, setStarsPrice] = useState(200);
  const [durationDays, setDurationDays] = useState(30);
  const [benefits, setBenefits] = useState("");

  async function refresh() {
    const res = await fetch("/api/studio/membership/plans");
    const json = await res.json();
    if (json?.ok) setPlans(json.plans);
  }

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/studio/membership/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, starsPrice, durationDays, benefits }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle("");
      setBenefits("");
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function update(id: string, patch: Partial<Plan>) {
    const res = await fetch(`/api/studio/membership/plans/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      alert("Update failed");
      return;
    }
    await refresh();
  }

  async function del(id: string) {
    const res = await fetch(`/api/studio/membership/plans/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Delete failed");
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold">Tạo gói Fan Club</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <div className="text-sm">Tên gói</div>
            <input className="w-full rounded-md border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="space-y-1">
            <div className="text-sm">Giá (⭐)</div>
            <input className="w-full rounded-md border px-3 py-2" type="number" value={starsPrice} onChange={(e) => setStarsPrice(Number(e.target.value))} />
          </label>
          <label className="space-y-1">
            <div className="text-sm">Thời hạn (ngày)</div>
            <input className="w-full rounded-md border px-3 py-2" type="number" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <div className="text-sm">Quyền lợi</div>
            <textarea className="w-full rounded-md border px-3 py-2" rows={3} value={benefits} onChange={(e) => setBenefits(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          disabled={creating || !title.trim()}
          onClick={create}
        >
          {creating ? "Đang tạo..." : "Tạo gói"}
        </button>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Gói hiện có</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có gói nào.</p>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.starsPrice}⭐ / {p.durationDays} ngày
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
                    onClick={() => update(p.id, { isActive: !p.isActive })}
                    type="button"
                  >
                    {p.isActive ? "Disable" : "Enable"}
                  </button>
                  <button className="rounded-md border px-3 py-1 text-sm hover:bg-muted" onClick={() => del(p.id)} type="button">
                    Delete
                  </button>
                </div>
              </div>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
                value={p.benefits || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setPlans((prev) => prev.map((x) => (x.id === p.id ? { ...x, benefits: v } : x)));
                }}
                onBlur={(e) => update(p.id, { benefits: e.target.value })}
                placeholder="Quyền lợi..."
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
