"use client";

import { useEffect, useMemo, useState } from "react";

export default function UpNextAutoplayClient({
  currentVideoId,
  next,
}: {
  currentVideoId: string;
  next: { url: string; title: string; thumbUrl: string | null } | null;
}) {
  const [show, setShow] = useState(false);
  const [sec, setSec] = useState(10);

  const enabled = useMemo(() => {
    try {
      const raw = localStorage.getItem("vs_autoplay_next");
      return raw == null ? true : raw === "true";
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    if (!next || !enabled) return;

    function onEnded(e: any) {
      const vid = e?.detail?.videoId;
      if (vid && vid !== currentVideoId) return;
      setShow(true);
      setSec(10);
    }

    window.addEventListener("videoshare:player-ended", onEnded as any);
    return () => window.removeEventListener("videoshare:player-ended", onEnded as any);
  }, [next, enabled, currentVideoId]);

  useEffect(() => {
    if (!show || !next) return;
    const id = window.setInterval(() => setSec((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [show, next]);

  useEffect(() => {
    if (!show || !next) return;
    if (sec <= 0) {
      window.location.href = next.url;
    }
  }, [sec, show, next]);

  if (!next || !enabled) return null;
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 320,
        zIndex: 50,
      }}
      className="card"
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Up next</div>
        <button className="btn" onClick={() => setShow(false)}>
          Close
        </button>
      </div>
      <div className="small muted mt-1">Autoplay in {sec}s</div>

      <a href={next.url} style={{ display: "block", marginTop: 10 }}>
        <div style={{ fontWeight: 800 }}>{next.title}</div>
        {next.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={next.thumbUrl}
            alt={next.title}
            style={{ width: "100%", marginTop: 8, borderRadius: 12, objectFit: "cover", aspectRatio: "16/9" }}
          />
        ) : null}
      </a>

      <div className="row" style={{ justifyContent: "space-between", marginTop: 10, gap: 8 }}>
        <button className="btn btn-primary" onClick={() => (window.location.href = next.url)}>
          Play now
        </button>
        <button className="btn" onClick={() => setShow(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
