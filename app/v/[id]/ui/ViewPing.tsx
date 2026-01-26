"use client";

import { useEffect } from "react";

export default function ViewPing({ videoId }: { videoId: string }) {
  useEffect(() => {
    fetch("/api/views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId }) }).catch(() => {});
  }, [videoId]);

  return null;
}
