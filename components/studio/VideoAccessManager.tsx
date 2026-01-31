"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type Gate = {
  id?: string;
  chain: string;
  collectionAddress: string | null;
  tokenMint: string | null;
  enabled: boolean;
};

type FanClubTier = "BRONZE" | "SILVER" | "GOLD";

function tierLabel(t: FanClubTier) {
  return t === "GOLD" ? "Gold" : t === "SILVER" ? "Silver" : "Bronze";
}

function isoToDatetimeLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function datetimeLocalToIso(v: string) {
  // Browser returns local time string. Convert to Date and then ISO.
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function VideoAccessManager({
  videoId,
  initialAccess,
  initialPremiumUnlockStars,
  initialGates,
  nftPremiumUnlockEnabled,
  initialEarlyAccessTier,
  initialEarlyAccessUntil,
}: {
  videoId: string;
  initialAccess: string;
  initialPremiumUnlockStars: number;
  initialGates: Gate[];
  nftPremiumUnlockEnabled: boolean;
  initialEarlyAccessTier: FanClubTier | null;
  initialEarlyAccessUntil: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  const [access, setAccess] = useState(initialAccess || "PUBLIC");
  const [premiumUnlockStars, setPremiumUnlockStars] = useState<number>(initialPremiumUnlockStars || 0);
  const [gates, setGates] = useState<Gate[]>(initialGates || []);

  // Early access (PUBLIC only)
  const [earlyAccessTier, setEarlyAccessTier] = useState<FanClubTier | "NONE">(
    (initialEarlyAccessTier as any) ?? "NONE"
  );
  const [earlyAccessUntilLocal, setEarlyAccessUntilLocal] = useState<string>(
    initialEarlyAccessUntil ? isoToDatetimeLocal(initialEarlyAccessUntil) : ""
  );

  const [chain, setChain] = useState("SOLANA");
  const [collectionAddress, setCollectionAddress] = useState("");
  const [tokenMint, setTokenMint] = useState("");
  const [enabled, setEnabled] = useState(true);

  const canAddGate = nftPremiumUnlockEnabled;

  const sorted = useMemo(() => [...gates], [gates]);

  async function save() {
    setMsg("");

    const earlyAccessUntilIso = earlyAccessUntilLocal ? datetimeLocalToIso(earlyAccessUntilLocal) : null;
    const res = await fetch(`/api/studio/videos/${videoId}/access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        access,
        premiumUnlockStars,
        gates,
        earlyAccessTier: earlyAccessTier === "NONE" ? null : earlyAccessTier,
        earlyAccessUntil: earlyAccessUntilIso,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setMsg(String(data?.message ?? "SAVE_FAILED"));
      return;
    }
    setMsg("Saved ✅");
    startTransition(() => {});
  }

  function addGateLocal() {
    setMsg("");
    if (!canAddGate) {
      setMsg("Admin chưa bật NFT Premium Unlock.");
      return;
    }
    const ca = collectionAddress.trim() || null;
    const tm = tokenMint.trim() || null;
    if (!ca && !tm) {
      setMsg("Nhập collection hoặc mint");
      return;
    }
    setGates((prev) => [...prev, { chain, collectionAddress: ca, tokenMint: tm, enabled }]);
    setCollectionAddress("");
    setTokenMint("");
  }

  function removeGate(idx: number) {
    setGates((prev) => prev.filter((_, i) => i !== idx));
  }

  const earlyAccessEnabled = access === "PUBLIC" && earlyAccessTier !== "NONE" && Boolean(earlyAccessUntilLocal);

  return (
    <div className="space-y-3">
      {msg ? <div className="text-sm">{msg}</div> : null}

      <Card className="p-3 space-y-3">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Access</div>
            <Select value={access} onChange={(e) => setAccess(e.target.value)}>
              <option value="PUBLIC">PUBLIC</option>
              <option value="UNLISTED">UNLISTED</option>
              <option value="PREMIUM">PREMIUM</option>
            </Select>
          </div>
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Premium Unlock Stars (0 = membership only)</div>
            <Input
              type="number"
              min={0}
              value={premiumUnlockStars}
              onChange={(e) => setPremiumUnlockStars(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button disabled={pending} onClick={save}>
            Save
          </Button>
        </div>
      </Card>

      <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold">Early Access (Fan Club)</div>
            <div className="text-xs text-muted-foreground">
              Chỉ áp dụng cho video <b>PUBLIC</b>. Trước thời điểm hết hạn, chỉ Fan Club tier đủ level mới xem được.
            </div>
          </div>
          <Badge variant="secondary">{earlyAccessEnabled ? "ENABLED" : "OFF"}</Badge>
        </div>

        {access !== "PUBLIC" ? (
          <div className="text-sm text-muted-foreground">Đổi Access về PUBLIC để bật Early Access.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            <div className="grid gap-1">
              <div className="text-xs text-muted-foreground">Required tier</div>
              <Select value={earlyAccessTier} onChange={(e) => setEarlyAccessTier(e.target.value as any)}>
                <option value="NONE">(Off)</option>
                <option value="BRONZE">Bronze</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
              </Select>
            </div>
            <div className="grid gap-1 md:col-span-2">
              <div className="text-xs text-muted-foreground">Until (local time)</div>
              <Input
                type="datetime-local"
                value={earlyAccessUntilLocal}
                onChange={(e) => setEarlyAccessUntilLocal(e.target.value)}
                placeholder="YYYY-MM-DDTHH:mm"
              />
              {earlyAccessTier !== "NONE" && earlyAccessUntilLocal ? (
                <div className="text-xs text-muted-foreground">
                  Người xem tier <b>{tierLabel(earlyAccessTier as FanClubTier)}</b> trở lên sẽ xem được cho tới thời điểm này.
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Để trống tier hoặc until để tắt.</div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold">NFT Unlock (Premium)</div>
            <div className="text-xs text-muted-foreground">Cho phép xem video PREMIUM nếu người xem sở hữu NFT key.</div>
          </div>
          <Badge variant="secondary">{nftPremiumUnlockEnabled ? "ENABLED" : "DISABLED (Admin)"}</Badge>
        </div>

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
            <Input
              value={collectionAddress}
              onChange={(e) => setCollectionAddress(e.target.value)}
              placeholder="0x... or collection address"
            />
          </div>
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Token mint (optional)</div>
            <Input value={tokenMint} onChange={(e) => setTokenMint(e.target.value)} placeholder="mint (optional)" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
            <div className="text-sm">Enabled</div>
          </div>
          <Button disabled={pending || !canAddGate} onClick={addGateLocal} variant="secondary">
            Add gate
          </Button>
        </div>

        <div className="space-y-2">
          {sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground">No gates.</div>
          ) : (
            sorted.map((g, idx) => (
              <Card key={idx} className="p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <Badge variant="secondary">{g.chain}</Badge>{" "}
                    {g.collectionAddress ? <span className="break-all">col={g.collectionAddress}</span> : null}{" "}
                    {g.tokenMint ? <span className="break-all">mint={g.tokenMint}</span> : null}
                  </div>
                  <Button disabled={pending} variant="destructive" onClick={() => removeGate(idx)}>
                    Remove
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
