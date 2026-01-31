"use client";

import { useEffect, useMemo, useState } from "react";

export default function ReferralClient() {
  const [me, setMe] = useState<{ code: string; shareUrl: string; referredById: string | null } | null>(null);
  const [claimCode, setClaimCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setMsg(null);
    try {
      const res = await fetch("/api/referrals/me");
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "LOAD_FAILED");
      setMe({ code: j.code, shareUrl: j.shareUrl, referredById: j.referredById ?? null });
    } catch (e: any) {
      setMsg(e?.message || "LOAD_FAILED");
    }
  }

  async function claim() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/referrals/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: claimCode }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "CLAIM_FAILED");
      setMsg("Claimed referral successfully.");
      setClaimCode("");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "CLAIM_FAILED");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shortUrl = useMemo(() => {
    if (!me?.shareUrl) return "";
    return me.shareUrl.length > 80 ? me.shareUrl.slice(0, 80) + "..." : me.shareUrl;
  }, [me?.shareUrl]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">Referral link của bạn</div>
        {!me ? (
          <div className="small muted mt-2">Loading...</div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="small">
              <b>Code:</b> <code>{me.code}</code>
            </div>
            <div className="small">
              <b>Link:</b> <code title={me.shareUrl}>{shortUrl}</code>
            </div>
            <button
              className="btn"
              onClick={() => navigator.clipboard.writeText(me.shareUrl)}
              disabled={!me.shareUrl}
            >
              Copy link
            </button>

            {me.referredById ? (
              <div className="small muted">Bạn đã được gắn referrer (không thể đổi).</div>
            ) : (
              <div className="small muted">Bạn chưa có referrer. Bạn có thể nhập code của người giới thiệu (1 lần).</div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="text-lg font-extrabold">Nhập code người giới thiệu</div>
        <div className="small muted mt-1">Chỉ được claim 1 lần, không thể đổi.</div>
        <div className="mt-3 row" style={{ gap: 8, alignItems: "center" }}>
          <input
            className="input"
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value)}
            placeholder="ABC123..."
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={claim} disabled={loading || !claimCode || Boolean(me?.referredById)}>
            {loading ? "..." : "Claim"}
          </button>
        </div>
        {msg ? <div className="small muted mt-2">{msg}</div> : null}
      </div>
    </div>
  );
}
