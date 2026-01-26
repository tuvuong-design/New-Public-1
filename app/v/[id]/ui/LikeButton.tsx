"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

export default function LikeButton({
  videoId,
  disabled,
}: {
  videoId: string;
  disabled?: boolean;
}) {
  const { data: session } = useSession();
  const [liked, setLiked] = useState(false);

  async function toggle() {
    if (disabled) return;
    if (!session) {
      alert("Bạn cần đăng nhập để like.");
      return;
    }

    const res = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    });

    if (!res.ok) {
      alert("Không thể like.");
      return;
    }

    setLiked(!liked);
  }

  return (
    <button
      className={`btn ${liked ? "btn-primary" : "btn-muted"}`}
      onClick={toggle}
      disabled={disabled}
      title={disabled ? "Tương tác đã bị tắt cho video này." : undefined}
    >
      {liked ? "Liked" : "Like"}
    </button>
  );
}
