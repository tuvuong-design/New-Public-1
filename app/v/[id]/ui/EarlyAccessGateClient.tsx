"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Tier = "BRONZE" | "SILVER" | "GOLD";

type Plan = {
  id: string;
  title: string | null;
  description: string | null;
  tier: Tier;
  priceStars: number;
  durationDays: number;
};

function tierLabel(t: Tier) {
  return t === "GOLD" ? "Gold" : t === "SILVER" ? "Silver" : "Bronze";
}

export default function EarlyAccessGateClient({
  creatorId,
  creatorName,
  requiredTier,
  untilIso,
  plans,
  viewerTier,
  loggedIn,
}: {
  creatorId: string;
  creatorName: string;
  requiredTier: Tier;
  untilIso: string;
  plans: Plan[];
  viewerTier: Tier | null;
  loggedIn: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  const untilText = useMemo(() => {
    try {
      return new Date(untilIso).toLocaleString();
    } catch {
      return untilIso;
    }
  }, [untilIso]);

  async function join(planId: string) {
    if (!loggedIn) {
      window.location.href = "/login";
      return;
    }
    setMsg("");
    setPending(planId);
    try {
      const res = await fetch("/api/creator-membership/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMsg(String(data?.message ?? "JOIN_FAILED"));
        return;
      }
      setMsg("Thành công! Reload để xem video ✅");
      setTimeout(() => window.location.reload(), 600);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-extrabold">Early Access</div>
          <Badge variant="secondary">⭐ {tierLabel(requiredTier)}+</Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          Video này đang ở chế độ Early Access. Chỉ Fan Club tier <b>{tierLabel(requiredTier)}</b> trở lên mới xem được
          cho tới <b>{untilText}</b>.
        </div>
        {viewerTier ? (
          <div className="text-sm">
            Tier của bạn: <Badge variant="secondary">⭐ {tierLabel(viewerTier)}</Badge>
          </div>
        ) : null}
        {!loggedIn ? (
          <div className="pt-2">
            <Button onClick={() => (window.location.href = "/login")}>Đăng nhập để tham gia</Button>
          </div>
        ) : null}
        {msg ? <div className="text-sm">{msg}</div> : null}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold">Tham gia Fan Club của {creatorName}</div>
        {plans.length === 0 ? (
          <div className="text-sm text-muted-foreground">Creator chưa tạo plan Fan Club.</div>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => {
              const rank = (t: Tier) => (t === "GOLD" ? 3 : t === "SILVER" ? 2 : 1);
              const meets = rank(p.tier) >= rank(requiredTier);
              return (
                <Card key={p.id} className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{p.title ?? `Plan ${tierLabel(p.tier)}`}</div>
                        <Badge variant={meets ? "default" : "secondary"}>⭐ {tierLabel(p.tier)}</Badge>
                        {meets ? <Badge variant="secondary">Unlock Early Access</Badge> : null}
                      </div>
                      {p.description ? (
                        <div className="mt-1 text-sm text-muted-foreground">{p.description}</div>
                      ) : null}
                      <div className="mt-1 text-sm">{p.priceStars} ⭐ / {p.durationDays} days</div>
                    </div>
                    <Button disabled={Boolean(pending)} onClick={() => join(p.id)}>
                      {pending === p.id ? "..." : "Join"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
