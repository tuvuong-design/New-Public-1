"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PaymentConfig = {
  id: number;
  strictMode: boolean;
  providerAccuracyMode: boolean;
  toleranceBps: number;
  submittedStaleMinutes: number;
  reconcileEveryMs: number;
  allowlistJson: string;
  // Growth / Monetization
  seasonPassEnabled?: boolean;
  seasonPassPriceStars?: number;

  referralEnabled?: boolean;
  referralPercent?: number;
  referralApplyToTopups?: boolean;
  referralApplyToEarnings?: boolean;
};

type SecretRow = {
  id: string;
  env: string;
  provider: string;
  name: string;
  value: string;
  active: boolean;
  updatedAt: string;
};

const PROVIDERS = ["ALCHEMY", "QUICKNODE", "HELIUS", "TRONGRID"];

export default function PaymentsConfigClient({
  initialConfig,
  initialSecrets,
}: {
  initialConfig: PaymentConfig;
  initialSecrets: any[];
}) {
  const [cfg, setCfg] = useState<PaymentConfig>({ ...initialConfig });
  const [allowlist, setAllowlist] = useState(initialConfig.allowlistJson || "{}");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [secrets, setSecrets] = useState<SecretRow[]>(() =>
    (initialSecrets || []).map((s: any) => ({ ...s, updatedAt: String(s.updatedAt) }))
  );

  const envs = useMemo(() => {
    const set = new Set(secrets.map((s) => s.env));
    if (!set.size) set.add("dev");
    return Array.from(set);
  }, [secrets]);

  const [newSecret, setNewSecret] = useState({ env: envs[0] || "dev", provider: "ALCHEMY", name: "webhookSecret", value: "" });

  async function saveConfig() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/payments/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...cfg,
          allowlistJson: allowlist,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "failed");
      setMsg("Saved config");
    } catch (e: any) {
      setMsg(e?.message || "failed");
    } finally {
      setSaving(false);
    }
  }

  async function upsertSecret() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/payments/secrets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newSecret),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "failed");
      const row = json.row as any;
      setSecrets((prev) => {
        const others = prev.filter((x) => !(x.env === row.env && x.provider === row.provider && x.name === row.name));
        return [{ ...row, updatedAt: String(row.updatedAt) }, ...others];
      });
      setMsg("Saved secret");
    } catch (e: any) {
      setMsg(e?.message || "failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Core settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Tolerance (bps) — 0.5% = 50</div>
              <Input
                type="number"
                value={cfg.toleranceBps}
                onChange={(e) => setCfg((p) => ({ ...p, toleranceBps: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">SUBMITTED stale minutes (auto reconcile)</div>
              <Input
                type="number"
                value={cfg.submittedStaleMinutes}
                onChange={(e) => setCfg((p) => ({ ...p, submittedStaleMinutes: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Cron every (ms) — default 120000 (2m)</div>
              <Input
                type="number"
                value={cfg.reconcileEveryMs}
                onChange={(e) => setCfg((p) => ({ ...p, reconcileEveryMs: Number(e.target.value || 0) }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cfg.strictMode} onCheckedChange={(v) => setCfg((p) => ({ ...p, strictMode: Boolean(v) }))} />
              Strict mode (enforce provider allowlist)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={cfg.providerAccuracyMode}
                onCheckedChange={(v) => setCfg((p) => ({ ...p, providerAccuracyMode: Boolean(v) }))}
              />
              Provider accuracy mode (verify signature)
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Allowlist JSON (per chain)</div>
            <Textarea value={allowlist} onChange={(e) => setAllowlist(e.target.value)} rows={10} className="font-mono text-xs" />
          </div>

          <div className="flex gap-2">
            <Button onClick={saveConfig} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            {msg ? <div className="text-sm text-muted-foreground self-center">{msg}</div> : null}
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Growth / Monetization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(cfg.seasonPassEnabled)}
                onCheckedChange={(v) => setCfg((p) => ({ ...p, seasonPassEnabled: Boolean(v) }))}
              />
              Season Pass enabled
            </label>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Season Pass price (Stars) — 30 days</div>
              <Input
                type="number"
                value={Number(cfg.seasonPassPriceStars || 300)}
                onChange={(e) => setCfg((p) => ({ ...p, seasonPassPriceStars: Number(e.target.value || 0) }))}
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="text-sm font-semibold">Referral Stars</div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(cfg.referralEnabled)}
                onCheckedChange={(v) => setCfg((p) => ({ ...p, referralEnabled: Boolean(v) }))}
              />
              Enable referral bonus (1–20%)
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Percent (1–20)</div>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={Number(cfg.referralPercent || 5)}
                  onChange={(e) => setCfg((p) => ({ ...p, referralPercent: Number(e.target.value || 0) }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm mt-6">
                <Checkbox
                  checked={cfg.referralApplyToTopups !== false}
                  onCheckedChange={(v) => setCfg((p) => ({ ...p, referralApplyToTopups: Boolean(v) }))}
                />
                Apply to TOPUP credits
              </label>
              <label className="flex items-center gap-2 text-sm mt-6">
                <Checkbox
                  checked={cfg.referralApplyToEarnings !== false}
                  onCheckedChange={(v) => setCfg((p) => ({ ...p, referralApplyToEarnings: Boolean(v) }))}
                />
                Apply to EARN credits (creator income)
              </label>
            </div>

            <div className="text-xs text-muted-foreground">
              Ledger: type=REFERRAL_BONUS, discountReason=REFERRAL_&lt;pct&gt;PCT, dedupe by (sourceKind, sourceId).
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveConfig} disabled={saving}>{saving ? "Saving..." : "Save growth settings"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider secrets (by env)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Env</div>
              <Select value={newSecret.env} onValueChange={(v) => setNewSecret((p) => ({ ...p, env: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {envs.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Provider</div>
              <Select value={newSecret.provider} onValueChange={(v) => setNewSecret((p) => ({ ...p, provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Name</div>
              <Input value={newSecret.name} onChange={(e) => setNewSecret((p) => ({ ...p, name: e.target.value }))} placeholder="webhookSigningKey" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Value</div>
              <Input value={newSecret.value} onChange={(e) => setNewSecret((p) => ({ ...p, value: e.target.value }))} placeholder="secret..." />
            </div>
          </div>
          <Button onClick={upsertSecret} disabled={saving || !newSecret.value || !newSecret.name}>Save secret</Button>

          <div className="text-xs text-muted-foreground">Latest (max 100)</div>
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50">
                  <th className="p-2 text-left">Env</th>
                  <th className="p-2 text-left">Provider</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Active</th>
                  <th className="p-2 text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {secrets.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="p-2">{s.env}</td>
                    <td className="p-2">{s.provider}</td>
                    <td className="p-2 font-mono text-xs">{s.name}</td>
                    <td className="p-2">{s.active ? "yes" : "no"}</td>
                    <td className="p-2">{new Date(s.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
