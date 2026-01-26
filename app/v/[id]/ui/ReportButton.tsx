"use client";

import { useState } from "react";

const reasons = [
  "Nội dung phản cảm / người lớn",
  "Bạo lực / kích động",
  "Spam / lừa đảo",
  "Bản quyền",
  "Ngôn từ thù ghét",
  "Khác",
];

export default function ReportButton({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId, reason, details }),
      }).then((r) => r.json());

      if (!res?.ok) {
        alert("Report failed");
        return;
      }
      alert("Đã gửi báo cáo. Cảm ơn bạn!");
      setOpen(false);
      setDetails("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Report">
        ⚑ Report
      </button>

      {open ? (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800 }}>Report video</div>
              <button type="button" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label>
                Lý do
                <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginTop: 6 }}>
                  {reasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Chi tiết (tuỳ chọn)
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Mô tả thêm..."
                  style={{ marginTop: 6, minHeight: 100 }}
                  maxLength={1000}
                />
              </label>

              <button type="button" disabled={loading} onClick={submit}>
                {loading ? "Sending..." : "Send report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
