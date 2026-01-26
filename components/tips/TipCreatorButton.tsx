"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function TipCreatorButton({
  toUserId,
  label = "Tip ⭐",
}: {
  toUserId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const idem = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const res = await fetch("/api/creator/tip", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": idem },
        body: JSON.stringify({ toUserId, stars: Math.floor(Number(stars) || 0), message, idempotencyKey: idem }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || (await res.text()));
      setMsg("Sent");
      setMessage("");
      setStars(5);
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-block">
      <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
        {label}
      </Button>

      {open ? (
        <div className="mt-2 w-[320px] max-w-[90vw] rounded-xl border bg-white p-3 shadow-sm">
          <div className="text-sm font-semibold">Tip creator</div>
          <div className="mt-2 grid gap-2">
            <Input
              type="number"
              min={1}
              max={9999}
              value={stars}
              onChange={(e) => setStars(Number(e.target.value))}
              placeholder="Stars"
            />
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message (optional)" />
            {msg ? <div className="text-xs text-muted-foreground">{msg}</div> : null}
            <div className="flex gap-2">
              <Button type="button" onClick={send} disabled={busy}>
                Send
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
