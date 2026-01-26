"use client";

import { useEffect, useRef, useState } from "react";

type Payload = {
  videoId?: string;
  stars?: number;
  sticker?: string; // url/path
  giftIcon?: string | null;
  giftName?: string | null;
};

function hueForStars(stars: number) {
  const max = 500;
  const t = Math.min(1, Math.log10(stars + 1) / Math.log10(max + 1));
  return Math.round(35 + t * 170);
}

export default function SuperThanksStickerOverlay({ videoId }: { videoId?: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      const d: Payload | undefined = e?.detail;
      if (!d) return;
      if (videoId && d.videoId && d.videoId !== videoId) return;

      setPayload(d);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setPayload(null);
      }, 1800);
    };

    window.addEventListener("superthanks:sent", handler);
    return () => {
      window.removeEventListener("superthanks:sent", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [videoId]);

  if (!payload) return null;

  const stars = payload.stars ?? 0;
  const hue = hueForStars(stars);
  const sticker = payload.sticker ?? "/stickers/star.gif";

  return (
    <div className="superthanks-sticker-wrap">
      <div className="superthanks-sticker" style={{ ["--st-hue" as any]: String(hue) } as any}>
        <img src={sticker} alt="Super Thanks" />
      </div>
    </div>
  );
}
