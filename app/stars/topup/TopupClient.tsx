"use client";

import { useEffect, useMemo, useState } from "react";

type PackageDto = {
  id: string;
  name: string;
  chain: string;
  assetSymbol: string;
  expectedAmount: string;
  stars: number;
  bonusStars?: number;
  bundleLabel?: string | null;
};

type DepositIntent = {
  id: string;
  chain: string;
  assetSymbol?: string;
  expectedAmount?: string | null;
  toAddress: string;
  memo: string;
  stars: number | null;
  bonusStars?: number;
  couponBonus?: number;
  totalStars?: number;
  couponCode?: string | null;
};

export default function TopupClient({ packages }: { packages: PackageDto[] }) {
  const [selected, setSelected] = useState<string>(() => packages[0]?.id ?? "");
  const [topupCoupon, setTopupCoupon] = useState<string>("");
  const [intent, setIntent] = useState<DepositIntent | null>(null);
  const [txHash, setTxHash] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [season, setSeason] = useState<{ enabled: boolean; priceStars: number; pass: any | null } | null>(null);
  const [buyingPass, setBuyingPass] = useState(false);
  const [passCoupon, setPassCoupon] = useState<string>("");

  async function loadSeasonPass() {
    try {
      const res = await fetch("/api/season-pass/status");
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "LOAD_SEASON_PASS_FAILED");
      setSeason({ enabled: Boolean(j.enabled), priceStars: Number(j.priceStars || 0), pass: j.pass ?? null });
    } catch {
      setSeason(null);
    }
  }

  async function buySeasonPass() {
    setErr(null);
    setBuyingPass(true);
    try {
      const res = await fetch("/api/season-pass/purchase", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ couponCode: passCoupon || undefined }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "BUY_SEASON_PASS_FAILED");
      await loadSeasonPass();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBuyingPass(false);
    }
  }


  const selectedPkg = useMemo(() => packages.find((p) => p.id === selected) ?? null, [packages, selected]);

  async function createIntent() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stars/topup/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId: selected, couponCode: topupCoupon || undefined }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "CREATE_INTENT_FAILED");
      setIntent(j.deposit as DepositIntent);
      setTxHash("");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function submitTx() {
    if (!intent) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stars/topup/submit-tx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ depositId: intent.id, txHash }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "SUBMIT_TX_FAILED");
      // keep intent, user can check history
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const [history, setHistory] = useState<any[] | null>(null);
  async function loadHistory() {
    try {
      const res = await fetch("/api/stars/topup/history");
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "LOAD_HISTORY_FAILED");
      setHistory(j.deposits);
    } catch {
      setHistory([]);
    }
  }

  async function retryDeposit(depositId: string) {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stars/topup/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ depositId }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "RETRY_FAILED");
      await loadHistory();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
    loadSeasonPass();
  }, []);

  return (
    <div className="space-y-4">

      <div className="card">
        <div className="text-lg font-extrabold">Season Pass (30 ngày)</div>
        <div className="small muted mt-1">Mở khóa xem Premium toàn site trong 30 ngày (gia hạn cộng dồn).</div>

        {!season ? (
          <div className="small muted mt-3">Loading...</div>
        ) : !season.enabled ? (
          <div className="small muted mt-3">Tính năng đang tắt bởi admin.</div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="small"><b>Giá:</b> {season.priceStars} Stars</div>
            <div className="mt-2">
              <div className="text-xs text-muted-foreground">Coupon (Season Pass)</div>
              <input
                className="input mt-1"
                value={passCoupon}
                onChange={(e) => setPassCoupon(e.target.value)}
                placeholder="Nhập mã coupon (tuỳ chọn)"
              />
              <div className="text-xs text-muted-foreground mt-1">Áp dụng giảm giá Stars khi mua Season Pass (nếu coupon hợp lệ).</div>
            </div>
            {season.pass?.endsAt ? (
              <div className="small"><b>Hết hạn:</b> {new Date(season.pass.endsAt).toLocaleString()}</div>
            ) : (
              <div className="small muted">Bạn chưa có Season Pass.</div>
            )}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={buySeasonPass} disabled={buyingPass || loading}>
                {buyingPass ? "Processing..." : "Mua / Gia hạn 30 ngày"}
              </button>
              <button className="btn" onClick={loadSeasonPass} disabled={buyingPass || loading}>Refresh</button>
            </div>
            <div className="small muted">Ledger: type=SEASON_PASS_PURCHASE, discountReason=SEASON_PASS_30D</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="text-lg font-extrabold">Chọn gói nạp</div>
        <div className="small muted mt-1">Chọn gói phù hợp và tạo “intent” để nhận địa chỉ nạp.</div>

        <div className="mt-3 space-y-2">
          {packages.map((p) => (
            <label key={p.id} className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="radio"
                name="pkg"
                checked={selected === p.id}
                onChange={() => setSelected(p.id)}
              />
              <div>
                <div style={{ fontWeight: 800 }}>{p.name}</div>
                <div className="small muted">
                  {p.chain} • {p.expectedAmount} {p.assetSymbol} → {p.stars} Stars{p.bonusStars && p.bonusStars > 0 ? ` + ${p.bonusStars} bonus` : ""}{p.bundleLabel ? ` (${p.bundleLabel})` : ""}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-3">
          <div className="text-xs text-muted-foreground">Coupon (Topup)</div>
          <input
            className="input mt-1"
            value={topupCoupon}
            onChange={(e) => setTopupCoupon(e.target.value)}
            placeholder="Nhập mã coupon (tuỳ chọn)"
          />
          <div className="text-xs text-muted-foreground mt-1">Coupon hợp lệ sẽ cộng thêm Stars bonus khi credit deposit.</div>
        </div>

        <div className="mt-3 row" style={{ gap: 8 }}>
          <button className="btn" onClick={createIntent} disabled={!selected || loading}>
            Create intent
          </button>
          <button className="btn" onClick={loadHistory} disabled={loading}>
            Refresh history
          </button>
        </div>

        {err ? <div className="mt-3 small" style={{ color: "#b00020" }}>{err}</div> : null}
      </div>

      {intent ? (
        <div className="card">
          <div className="text-lg font-extrabold">Hướng dẫn nạp</div>
          <div className="small muted mt-1">
            Gửi đúng số tiền theo gói. Với Solana nên gửi kèm memo để auto-match.
          </div>
          <div className="mt-3 space-y-2">
            <div className="small"><b>Chain:</b> {intent.chain}</div>
            <div className="small"><b>To:</b> <code>{intent.toAddress}</code></div>
            {intent.memo ? <div className="small"><b>Memo:</b> <code>{intent.memo}</code></div> : null}
            {intent.expectedAmount ? (
              <div className="small"><b>Expected:</b> {intent.expectedAmount} {intent.assetSymbol}</div>
            ) : null}
            {intent.stars ? <div className="small"><b>Stars:</b> {intent.stars}</div> : null}
            {typeof intent.bonusStars === "number" && intent.bonusStars > 0 ? (
              <div className="small"><b>Bundle bonus:</b> +{intent.bonusStars}</div>
            ) : null}
            {typeof intent.couponBonus === "number" && intent.couponBonus > 0 ? (
              <div className="small"><b>Coupon bonus:</b> +{intent.couponBonus}{intent.couponCode ? ` (${intent.couponCode})` : ""}</div>
            ) : null}
            {typeof intent.totalStars === "number" && intent.totalStars > 0 ? (
              <div className="small"><b>Total credited (preview):</b> {intent.totalStars}</div>
            ) : null}
          </div>

          <div className="mt-4" style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
            <div className="small" style={{ fontWeight: 800 }}>Sau khi gửi xong, dán txHash:</div>
            <div className="mt-2 row" style={{ gap: 8, alignItems: "center" }}>
              <input
                className="input"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Transaction hash"
                style={{ flex: 1 }}
              />
              <button className="btn" onClick={submitTx} disabled={!txHash || loading}>
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="text-lg font-extrabold">Lịch sử nạp</div>
        <div className="small muted mt-1">Trạng thái sẽ được worker reconcile (có thể mất vài phút).</div>

        {!history ? (
          <div className="small muted mt-3">Loading...</div>
        ) : history.length === 0 ? (
          <div className="small muted mt-3">Chưa có giao dịch.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {history.map((d) => (
              <div key={d.id} className="card" style={{ background: "#fafafa" }}>
                <div style={{ fontWeight: 800 }}>{d.status}</div>
                <div className="small muted">
                  {d.chain} • {d.expectedAmount ?? "?"} {d.assetSymbol ?? ""}
                </div>
                {d.txHash ? <div className="small"><code>{d.txHash}</code></div> : null}
                <div className="small muted">{new Date(d.createdAt).toLocaleString()}</div>

                {d.status === "FAILED" || d.status === "NEEDS_REVIEW" || d.status === "UNMATCHED" ? (
                  <div className="mt-2">
                    <button className="btn" onClick={() => retryDeposit(d.id)} disabled={loading}>
                      Retry reconcile
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
