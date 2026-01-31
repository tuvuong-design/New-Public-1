"use client";

import { useMemo, useState } from "react";

const KNOWN_TYPES: { key: string; label: string }[] = [
  { key: "COMMENT_REPLY", label: "Có người trả lời bình luận của bạn" },
  { key: "VIDEO_LIKE", label: "Có người thích video của bạn" },
  { key: "VIDEO_COMMENT", label: "Có người bình luận video của bạn" },
  { key: "NEW_SUBSCRIBER", label: "Có người theo dõi bạn" },
  { key: "STAR_GIFT", label: "Nhận quà sao" },
  { key: "CREATOR_TIP", label: "Nhận tip từ người xem" },
  { key: "CREATOR_MEMBERSHIP", label: "Có người join Fan Club" },
  { key: "WEEKLY_DIGEST", label: "Tóm tắt tuần (in-app)" },
  { key: "CONTINUE_WATCHING_DIGEST", label: "Nhắc tiếp tục xem (in-app)" },
  { key: "WEEKLY_DIGEST_EMAIL", label: "Tóm tắt tuần (email)" },
];

export function NotificationSettingsForm({ initialDisabled }: { initialDisabled: string[] }) {
  const initial = useMemo(() => new Set((initialDisabled || []).map((x) => String(x).trim()).filter(Boolean)), [initialDisabled]);
  const [disabled, setDisabled] = useState<Set<string>>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(k: string) {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setSaved(null);
    setError(null);
    try {
      const res = await fetch("/api/me/notifications/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disabled: Array.from(disabled) }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved("Đã lưu.");
    } catch (e: any) {
      setError(e?.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {KNOWN_TYPES.map((t) => (
          <label key={t.key} className="flex items-center gap-3">
            <input type="checkbox" checked={!disabled.has(t.key)} onChange={() => toggle(t.key)} />
            <span>{t.label}</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        disabled={saving}
        onClick={save}
      >
        {saving ? "Đang lưu..." : "Lưu cài đặt"}
      </button>

      {saved ? <p className="text-sm text-green-600">{saved}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
