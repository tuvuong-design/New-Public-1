"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Endpoint = {
  id: string;
  url: string;
  enabled: boolean;
  events: string[];
  createdAt: string;
  updatedAt: string;
};

const AllowedEvents = ["TIP_RECEIVED"]; // Keep in sync with API

export default function WebhooksManager({ initial }: { initial: Endpoint[] }) {
  const [items, setItems] = useState<Endpoint[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [newUrl, setNewUrl] = useState("");
  const [newEnabled, setNewEnabled] = useState(true);
  const [newEvents, setNewEvents] = useState<Record<string, boolean>>({ TIP_RECEIVED: true });
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const selectedEvents = useMemo(
    () => AllowedEvents.filter((e) => Boolean(newEvents[e])),
    [newEvents]
  );

  async function refresh() {
    const res = await fetch("/api/studio/webhooks", { method: "GET" });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setItems(data.items ?? []);
  }

  async function create() {
    setBusy(true);
    setMsg(null);
    setCreatedSecret(null);
    try {
      const res = await fetch("/api/studio/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: newUrl, enabled: newEnabled, events: selectedEvents }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || (await res.text()));
      setCreatedSecret(data?.item?.secret ?? null);
      setNewUrl("");
      await refresh();
      setMsg("Created");
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, patch: Partial<Pick<Endpoint, "url" | "enabled" | "events">>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/studio/webhooks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || (await res.text()));
      await refresh();
      setMsg("Saved");
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this endpoint?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/studio/webhooks/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || (await res.text()));
      await refresh();
      setMsg("Deleted");
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {msg ? <div className="text-sm text-muted-foreground">{msg}</div> : null}
          {createdSecret ? (
            <div className="rounded-xl border bg-amber-50 p-3 text-sm">
              <div className="font-semibold">Secret (copy now)</div>
              <div className="mt-1 font-mono break-all">{createdSecret}</div>
              <div className="mt-1 text-xs text-muted-foreground">Vì bảo mật, secret chỉ trả về 1 lần khi tạo.</div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>URL (https://...)</Label>
            <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com/webhooks/videoshare" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={newEnabled} onCheckedChange={(v) => setNewEnabled(Boolean(v))} />
            <Label>Enabled</Label>
          </div>

          <div className="grid gap-2">
            <Label>Events</Label>
            <div className="flex flex-wrap gap-3">
              {AllowedEvents.map((e) => (
                <label key={e} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(newEvents[e])}
                    onChange={(ev) => setNewEvents((p) => ({ ...p, [e]: ev.target.checked }))}
                  />
                  {e}
                </label>
              ))}
            </div>
          </div>

          <Button type="button" onClick={create} disabled={busy || !newUrl.trim() || selectedEvents.length === 0}>
            Create
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {items.length === 0 ? (
          <div className="card small muted">Chưa có endpoint nào.</div>
        ) : (
          items.map((it) => (
            <Card key={it.id}>
              <CardHeader>
                <CardTitle className="text-base">{it.url}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={it.enabled}
                      onCheckedChange={(v) => patch(it.id, { enabled: Boolean(v) })}
                    />
                    <span className="text-sm">Enabled</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Updated: {new Date(it.updatedAt).toLocaleString()}</div>
                </div>

                <div className="grid gap-2">
                  <Label>URL</Label>
                  <div className="flex gap-2">
                    <Input
                      defaultValue={it.url}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== it.url) patch(it.id, { url: v });
                      }}
                    />
                    <Button type="button" variant="secondary" onClick={() => remove(it.id)}>
                      Delete
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">(blur để lưu URL)</div>
                </div>

                <div className="grid gap-2">
                  <Label>Events</Label>
                  <div className="flex flex-wrap gap-3">
                    {AllowedEvents.map((e) => {
                      const checked = it.events.includes(e);
                      return (
                        <label key={e} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(ev) => {
                              const next = ev.target.checked
                                ? Array.from(new Set([...it.events, e]))
                                : it.events.filter((x) => x !== e);
                              patch(it.id, { events: next });
                            }}
                          />
                          {e}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
