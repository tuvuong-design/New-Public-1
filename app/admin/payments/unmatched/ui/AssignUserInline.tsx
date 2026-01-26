"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AssignUserInline({ depositId }: { depositId: string }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/payments/deposits/assign-user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ depositId, email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "failed");
      setMsg("Assigned");
      setEmail("");
    } catch (e: any) {
      setMsg(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@email" className="h-9 w-[180px]" />
        <Button size="sm" onClick={submit} disabled={loading || !email}>Assign</Button>
      </div>
      {msg ? <div className="text-xs text-muted-foreground">{msg}</div> : null}
    </div>
  );
}
