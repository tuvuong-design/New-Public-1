"use client";

import { useEffect, useRef } from "react";

export default function ProgressSaver({ videoId }: { videoId: string }) {
  const timer = useRef<any>(null);

  useEffect(() => {
    const el = document.querySelector("video");
    if (!el) return;

    const onTime = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const seconds = Math.floor((el as HTMLVideoElement).currentTime || 0);
        await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId, seconds }),
        }).catch(() => {});
      }, 800);
    };

    el.addEventListener("timeupdate", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [videoId]);

  return null;
}
