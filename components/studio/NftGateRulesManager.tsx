"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type Rule = {
  id: string;
  chain: string;
  collectionAddress: string | null;
  tokenMint: string | null;
  minBalance: number;
  mapsToTier: "BRONZE" | "SILVER" | "GOLD";
  enabled: boolean;
  createdAt: string;
};

export default function NftGateRulesManager({ initialRules }: { initialRules: Rule[] }) {
  const [rules, setRules] = useState<Rule[]>(initialRules || []);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  const [chain, setChain] = useState("SOLANA");
  const [collectionAddress, setCollectionAddress] = useState("");
  const [tokenMint, setTokenMint] = useState("");
  const [minBalance, setMinBalance] = useState(1);
  const [tier, setTier] = useState<Rule["mapsToTier"]>("SILVER");
  const [enabled, setEnabled] = useState(true);

  const sorted = useMemo(() => [...rules].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [rules]);

  async function refresh() {
    const res = await fetch("/api/studio/membership/nft-gate");
    const data = await res.json().catch(() => ({}));
    if (data?.ok && Array.isArray(data.rules)) setRules(data.rules);
  }

  async function addRule() {
    setMsg("");
    const res = await fetch("/api/studio/membership/nft-gate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chain,
        collectionAddress: collectionAddress.trim() || null,
        tokenMint: tokenMint.trim() || null,
        minBalance: Number(minBalance) || 1,
        mapsToTier: tier,
        enabled,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) { setMsg(String(data?.message ?? "SAVE_FAILED")); return; }
    setCollectionAddress("");
    setTokenMint("");
    startTransition(() => refresh());
  }

  async function removeRule(id: string) {
    setMsg("");
    const res = await fetch("/api/studio/membership/nft-gate", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) { setMsg(String(data?.message ?? "DELETE_FAILED")); return; }
    startTransition(() => refresh());
  }

  return (
    <div className="space-y-3">
      {msg ? <div className="text-sm">{msg}</div> : null}

      <Card className="p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Chain</div>
            <Select value={chain} onChange={(e) => setChain(e.target.value)}>
              <option value="SOLANA">SOLANA</option>
              <option value="ETHEREUM">ETHEREUM</option>
              <option value="POLYGON">POLYGON</option>
              <option value="BSC">BSC</option>
              <option value="BASE">BASE</option>
            </Select>
          </div>
          <div className="grid gap-1 md:col-span-2">
            <div className="text-xs text-muted-foreground">Collection (contract) address</div>
            <Input value={collectionAddress} onChange={(e) => setCollectionAddress(e.target.value)} placeholder="0x... or collection address" />
          </div>
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Token mint (optional)</div>
            <Input value={tokenMint} onChange={(e) => setTokenMint(e.target.value)} placeholder="mint address (optional)" />
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Min balance</div>
            <Input type="number" min={1} value={minBalance} onChange={(e) => setMinBalance(Number(e.target.value))} />
          </div>
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Maps to tier</div>
            <Select value={tier} onChange={(e) => setTier(e.target.value as any)}>
              <option value="BRONZE">BRONZE</option>
              <option value="SILVER">SILVER</option>
              <option value="GOLD">GOLD</option>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
            <div className="text-sm">Enabled</div>
          </div>
          <div className="pt-5">
            <Button disabled={pending} onClick={addRule}>Add rule</Button>
          </div>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          Rule match: user wallet snapshot có assetKey trùng <b>collectionAddress</b> hoặc <b>tokenMint</b> (tuỳ bạn set) và balance ≥ minBalance.
        </div>
      </Card>

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground">Chưa có rule nào.</div>
        ) : (
          sorted.map((r) => (
            <Card key={r.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    <Badge variant="secondary">{r.chain}</Badge>{" "}
                    {r.collectionAddress ? <span className="break-all">col={r.collectionAddress}</span> : null}{" "}
                    {r.tokenMint ? <span className="break-all">mint={r.tokenMint}</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">minBalance={r.minBalance} → tier={r.mapsToTier}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{r.enabled ? "ENABLED" : "DISABLED"}</Badge>
                  <Button disabled={pending} variant="destructive" onClick={() => removeRule(r.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
