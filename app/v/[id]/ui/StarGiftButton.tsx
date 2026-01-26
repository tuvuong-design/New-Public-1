"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Gift = { id: string; name: string; icon: string | null; starsCost: number };

type Tab = "gifts" | "stars";

export default function StarGiftButton({
  videoId,
  initialStarCount,
  initialGiftCount,
  disabled,
}: {
  videoId: string;
  initialStarCount: number;
  initialGiftCount: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("gifts");
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const [starCount, setStarCount] = useState(initialStarCount);
  const [giftCount, setGiftCount] = useState(initialGiftCount);

  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [customStars, setCustomStars] = useState(10);

  function superThanksTierClass(stars: number) {
    if (stars <= 5) return "superthanks-tier-bronze";
    if (stars <= 10) return "superthanks-tier-silver";
    if (stars <= 25) return "superthanks-tier-gold";
    if (stars <= 50) return "superthanks-tier-platinum";
    return "superthanks-tier-diamond";
  }

  useEffect(() => {
    if (!open) return;
    setAnonymous(false);

    (async () => {
      try {
        const g = await fetch("/api/gifts", { cache: "no-store" }).then((r) => r.json());
        if (g?.ok) setGifts(g.gifts ?? []);
      } catch {
        // ignore
      }

      try {
        const b = await fetch("/api/stars/balance", { cache: "no-store" }).then((r) => r.json());
        if (b?.ok) setBalance(b.starBalance ?? 0);
        else setBalance(null);
      } catch {
        setBalance(null);
      }
    })();
  }, [open]);

  async function sendGift(giftId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/gifts/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId, giftId, quantity: qty, message, anonymous }),
      }).then((r) => r.json());

      if (!res?.ok) {
        alert(res?.message ?? "Send gift failed. Bạn cần đăng nhập và đủ stars.");
        return;
      }

      if (typeof res.starBalance === "number") setBalance(res.starBalance);
      if (typeof res.starCount === "number") setStarCount(res.starCount);
      if (typeof res.giftCount === "number") setGiftCount(res.giftCount);

      setOpen(false);

      // optional: let other UI react
      window.dispatchEvent(
        new CustomEvent("superthanks:sent", {
          detail: { videoId, stars: res?.stars ?? 0, giftName: res?.giftName, giftIcon: res?.giftIcon },
        })
      );

      const el = document.getElementById("comments");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setLoading(false);
    }
  }

  async function sendStars() {
    setLoading(true);
    try {
      const res = await fetch("/api/stars/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId, amount: customStars, message, anonymous }),
      }).then((r) => r.json());

      if (!res?.ok) {
        alert(res?.message ?? "Send stars failed. Bạn cần đăng nhập và đủ stars.");
        return;
      }

      if (typeof res.starBalance === "number") setBalance(res.starBalance);
      if (typeof res.starCount === "number") setStarCount(res.starCount);

      setOpen(false);
      window.dispatchEvent(new CustomEvent("superthanks:sent", { detail: { videoId, stars: customStars } }));

      const el = document.getElementById("comments");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="superthanks-trigger"
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        disabled={disabled}
        title={disabled ? "Tương tác đã bị tắt" : "Tặng sao / quà"}
      >
        ⭐ {starCount}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Card className="max-h-[85vh] overflow-auto">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Tặng quà / sao</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    Stars received: <b>{starCount}</b> • Gifts: <b>{giftCount}</b>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Đóng
                </Button>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="text-sm font-semibold">Balance</div>
                  <div className="text-sm">
                    {balance === null ? <span className="text-muted-foreground">Login để xem</span> : <b>⭐ {balance}</b>}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={tab === "gifts" ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setTab("gifts")}
                  >
                    Gifts
                  </Button>
                  <Button
                    type="button"
                    variant={tab === "stars" ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setTab("stars")}
                  >
                    Stars
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Message</div>
                  <Textarea
                    placeholder="Viết lời nhắn (tuỳ chọn)..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={500}
                  />
                  <div className="text-xs text-muted-foreground">Lời nhắn sẽ hiển thị như Super Thanks trong phần bình luận.</div>

                  <div className="flex items-center gap-2 rounded-lg border p-3">
                    <Checkbox id="anonymous" checked={anonymous} onCheckedChange={(v) => setAnonymous(Boolean(v))} />
                    <Label htmlFor="anonymous" className="text-sm">Gửi ẩn danh (không hiển thị tên)</Label>
                  </div>
                </div>

                {tab === "gifts" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">Gifts</div>
                      <div className="flex items-center gap-2 text-sm">
                        Qty
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={qty}
                          onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                          className="w-20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {gifts.map((g) => {
                        const cost = g.starsCost * qty;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            disabled={loading}
                            onClick={() => void sendGift(g.id)}
                            className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted disabled:opacity-60"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{g.icon ?? "🎁"}</span>
                              <div>
                                <div className="text-sm font-semibold">{g.name}</div>
                                <div className="text-xs text-muted-foreground">⭐ {g.starsCost} / each</div>
                              </div>
                            </div>
                            <div className="text-sm font-semibold">⭐ {cost}</div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-xs text-muted-foreground">Không đủ stars? Hãy topup trong /stars/topup hoặc nhờ admin cấp stars.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">Send Stars</div>
                      <div className="flex items-center gap-2 text-sm">
                        Amount
                        <Input
                          type="number"
                          min={1}
                          max={9999}
                          value={customStars}
                          onChange={(e) => setCustomStars(Math.max(1, Math.min(9999, Number(e.target.value) || 1)))}
                          className="w-24"
                        />
                      </div>
                    </div>

                    <Button
                      disabled={loading}
                      onClick={() => void sendStars()}
                      className={`superthanks-btn ${superThanksTierClass(customStars)}`}
                    >
                      <span className="superthanks-spin" aria-hidden="true">⭐</span>
                      <span className="ml-2">Gửi ⭐ {customStars}</span>
                    </Button>

                    <div className="text-xs text-muted-foreground">Stars sẽ tạo một bình luận Super Thanks.</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
