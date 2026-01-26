"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

export default function ShareButton({
  videoId,
  initialCount,
  disabled,
}: {
  videoId: string;
  initialCount: number;
  disabled?: boolean;
}) {
  const { data: session } = useSession();
  const [count, setCount] = useState(initialCount);

  async function share() {
    if (disabled) return;
    if (!session) {
      alert("Bạn cần đăng nhập để chia sẻ");
      return;
    }

    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      if (!res.ok) {
        alert("Không thể chia sẻ");
        return;
      }
      setCount((c) => c + 1);
      await navigator.clipboard.writeText(`${window.location.origin}/v/${videoId}`);
      alert("Đã copy link!");
    } catch {
      alert("Không thể chia sẻ");
    }
  }

  return (
    <button className="btn" onClick={share} disabled={disabled} title={disabled ? "Tương tác đã bị tắt" : undefined}>
      🔗 Share ({count})
    </button>
  );
}
