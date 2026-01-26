"use client";

import { useEffect, useMemo, useState } from "react";

type Scope = "GLOBAL_TOP" | "GLOBAL_BOTTOM";

export default function GlobalBannerAds({ scope }: { scope: Scope }) {
  const [enabled, setEnabled] = useState(false);
  const [html, setHtml] = useState<string>("");

  const isClient = typeof window !== "undefined";
  const key = useMemo(() => scope, [scope]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/ads?scope=${encodeURIComponent(key)}`, { cache: "no-store" });
        const j = await res.json();
        if (cancelled) return;
        setEnabled(Boolean(j?.enabled));
        setHtml(typeof j?.html === "string" ? j.html : "");
      } catch {
        if (cancelled) return;
        setEnabled(false);
        setHtml("");
      }
    }
    if (isClient) void load();
    return () => {
      cancelled = true;
    };
  }, [isClient, key]);

  if (!enabled || !html || html.trim().length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
      <div
        className="my-2 rounded-lg border bg-background p-2"
        // Admin-controlled HTML. Keep it isolated.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
