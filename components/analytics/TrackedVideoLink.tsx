"use client";

import { useEffect, useRef } from "react";

export type TrafficSource =
  | "HOME"
  | "FEED"
  | "SEARCH"
  | "EXPLORE"
  | "TRENDING"
  | "PLAYLIST"
  | "CHANNEL"
  | "EXTERNAL"
  | "UNKNOWN";

function sendAnalytics(events: Array<Record<string, any>>) {
  fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: events.map((e) => ({ ...e, ts: Date.now() })) }),
    keepalive: true,
  }).catch(() => {});
}

export default function TrackedVideoLink({
  href,
  videoId,
  source,
  placement,
  className,
  children,
}: {
  href: string;
  videoId: string;
  source: TrafficSource;
  placement?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const impressionSentRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (impressionSentRef.current) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (impressionSentRef.current) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          // Debounce to reduce noisy scroll counts
          if (timerRef.current) return;
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            if (impressionSentRef.current) return;
            impressionSentRef.current = true;
            sendAnalytics([
              {
                type: "CARD_IMPRESSION",
                videoId,
                source,
                placement,
              },
            ]);
          }, 300);
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [videoId, source, placement]);

  return (
    <a
      ref={ref}
      href={href}
      className={className}
      onClick={() => {
        sendAnalytics([
          {
            type: "CARD_CLICK",
            videoId,
            source,
            placement,
          },
        ]);
      }}
    >
      {children}
    </a>
  );
}
