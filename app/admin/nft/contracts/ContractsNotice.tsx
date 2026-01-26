"use client";

import { useSearchParams } from "next/navigation";

export function ContractsNotice() {
  const sp = useSearchParams();
  const ok = sp.get("ok");
  const err = sp.get("err");
  const chain = sp.get("chain");
  const applyAt = sp.get("applyAt");

  if (!ok && !err) return null;

  const title = ok ? "✅ Updated" : "⚠️ Action blocked";
  let msg = "";
  if (ok === "PENDING_SET") {
    msg = `Đã set pending contract cho ${chain || "(unknown)"}. Sẽ có hiệu lực sau mốc delay (dự kiến: ${applyAt ? new Date(applyAt).toLocaleString() : ""}).`;
  } else if (ok === "APPLIED") {
    msg = `Đã áp dụng pending contract cho ${chain || "(unknown)"}.`;
  } else if (err === "NOT_DUE_YET") {
    msg = `Chưa đến thời điểm được phép apply cho ${chain || "(unknown)"}. ApplyAt: ${applyAt ? new Date(applyAt).toLocaleString() : ""}.`;
  } else {
    msg = `Lỗi: ${err}`;
  }

  return (
    <div className="card border border-border/60">
      <div className="text-sm font-semibold">{title}</div>
      <div className="small muted">{msg}</div>
      <div className="small muted mt-1">
        Lưu ý: các NFT đã export không bị ảnh hưởng vì mỗi export request lưu <span className="font-mono">contractAddress</span> tại thời điểm rút.
      </div>
    </div>
  );
}
