"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DepositDetailActions({
  depositId,
  currentStatus,
}: {
  depositId: string;
  currentStatus: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function post(url: string, body: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "failed");
    return json;
  }

  async function doAssign() {
    setLoading(true);
    setMessage(null);
    try {
      await post("/api/admin/payments/deposits/assign-user", { depositId, email });
      setMessage("Assigned user. Reconcile enqueued.");
    } catch (e: any) {
      setMessage(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  async function doReconcile() {
    setLoading(true);
    setMessage(null);
    try {
      await post("/api/admin/payments/deposits/reconcile", { depositId });
      setMessage("Reconcile enqueued.");
    } catch (e: any) {
      setMessage(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  async function doCredit() {
    setLoading(true);
    setMessage(null);
    try {
      await post("/api/admin/payments/deposits/manual-credit", { depositId });
      setMessage("Manual credit executed.");
    } catch (e: any) {
      setMessage(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  async function doRefund() {
    setLoading(true);
    setMessage(null);
    try {
      await post("/api/admin/payments/deposits/refund", { depositId });
      setMessage("Refund executed.");
    } catch (e: any) {
      setMessage(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="text-sm font-semibold">Actions</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={doReconcile} disabled={loading} variant="secondary">Retry verify</Button>
        <Button onClick={doCredit} disabled={loading || currentStatus === "CREDITED"}>Manual credit</Button>
        <Button onClick={doRefund} disabled={loading} variant="secondary">Refund</Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input placeholder="Assign user by email" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-xs" />
        <Button onClick={doAssign} disabled={loading || !email}>Assign user</Button>
      </div>
      {message ? <div className="mt-2 text-sm">{message}</div> : null}
      <div className="mt-2 text-xs text-muted-foreground">
        Worker cron will auto-reconcile SUBMITTED &gt; X minutes (default in ENV: PAYMENTS_SUBMITTED_STALE_MINUTES).
      </div>
    </div>
  );
}
