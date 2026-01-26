"use client";

import Hls from "hls.js";
import { useEffect, useMemo, useRef, useState } from "react";
import SuperThanksStickerOverlay from "@/components/superthanks/SuperThanksStickerOverlay";

type Storyboard = {
  enabled: boolean;
  url: string | null;
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  count: number;
  intervalMs: number;
};

function fmt(sec: number) {
  if (!isFinite(sec)) return "0:00";
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function VideoPlayer({
  videoId,
  src,
  poster,
  autoPlay,
  muted,
  loop,
  mode = "standard",
  storyboard,
  analytics,
  preload = "metadata",
}: {
  videoId?: string;
  src: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  mode?: "standard" | "tiktok";
  storyboard?: Storyboard;
  analytics?: {
    experimentId?: string | null;
    variantId?: string | null;
  } | null;
  preload?: "none" | "metadata" | "auto";
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rangeRef = useRef<HTMLInputElement | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const viewPingedRef = useRef(false);
  const exposureSentRef = useRef(false);
  const lastTimeRef = useRef(0);
  const playedAccRef = useRef(0);
  const lastPresenceSentRef = useRef(0);
  const lastProgressSentRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [previewLeft, setPreviewLeft] = useState(0);
  const [previewW, setPreviewW] = useState(160);

  const sb = storyboard;
  const sbEnabled = Boolean(sb?.enabled && sb.url && sb.count > 0 && sb.intervalMs > 0);

  const analyticsEnabled = Boolean(videoId);

  // Allow external components (chapters list, etc.) to seek this player.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onSeek = (ev: Event) => {
      const e = ev as CustomEvent<{ videoId?: string; timeSec: number }>;
      const targetId = e.detail?.videoId;
      if (targetId && videoId && targetId !== videoId) return;
      const t = Math.max(0, Number(e.detail?.timeSec ?? 0));
      if (!isFinite(t)) return;
      try {
        v.currentTime = t;
        // If paused, keep paused (UX). If playing, continue playing.
      } catch {
        // ignore
      }
    };
    window.addEventListener("videoshare:player:seek", onSeek as any);
    return () => window.removeEventListener("videoshare:player:seek", onSeek as any);
  }, [videoId]);

  function sendAnalytics(events: Array<Record<string, any>>) {
    if (!analyticsEnabled || !videoId) return;
    fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: events.map((e) => ({
          ...e,
          videoId,
          experimentId: analytics?.experimentId ?? undefined,
          variantId: analytics?.variantId ?? undefined,
          ts: Date.now(),
        })),
      }),
    }).catch(() => {});
  }

  // Presence ping for realtime viewers.
  useEffect(() => {
    if (!analyticsEnabled) return;
    const tick = () => {
      const now = Date.now();
      if (now - lastPresenceSentRef.current < 15_000) return;
      lastPresenceSentRef.current = now;
      sendAnalytics([{ type: "PRESENCE" }]);
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [analyticsEnabled, videoId, analytics?.experimentId, analytics?.variantId]);

  // Exposure event (counts impressions for A/B experiments).
  useEffect(() => {
    if (!analyticsEnabled) return;
    if (exposureSentRef.current) return;
    exposureSentRef.current = true;
    sendAnalytics([{ type: "EXPOSURE" }]);
  }, [analyticsEnabled, videoId, analytics?.experimentId, analytics?.variantId]);

  // Attach HLS (only when src is an HLS playlist). For mp4 clips, use direct src.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isHls = /\.m3u8(\?|$)/i.test(src);
    let hls: Hls | null = null;

    if (!isHls) {
      video.src = src;
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [src]);
  // Size-based preview (scale by video width)
  useEffect(() => {
    function recalc() {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const w = clamp(rect.width * 0.35, 120, 240);
      setPreviewW(w);
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  // Auto play/pause by parent feed
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (autoPlay) {
      video.muted = muted ?? true;
      video.loop = loop ?? false;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [autoPlay, muted, loop]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => {
      setReady(true);
      setDuration(v.duration || 0);
      lastTimeRef.current = v.currentTime || 0;
    };
    const onTime = () => {
      if (!scrubbing) setCurrent(v.currentTime || 0);

      // Analytics progress (played seconds, not wall clock)
      if (!analyticsEnabled || v.paused) {
        lastTimeRef.current = v.currentTime || 0;
        return;
      }
      const cur = v.currentTime || 0;
      const prev = lastTimeRef.current || 0;
      let delta = cur - prev;
      // Ignore large jumps (seek) or negative delta
      if (delta > 0 && delta < 5) {
        playedAccRef.current += delta;
      }
      lastTimeRef.current = cur;

      const now = Date.now();
      if (playedAccRef.current >= 10 && now - lastProgressSentRef.current >= 8000) {
        lastProgressSentRef.current = now;
        const deltaSec = Math.max(1, Math.floor(playedAccRef.current));
        playedAccRef.current = 0;

        const dur = v.duration || 0;
        const watchPctBp = dur > 0 ? Math.max(0, Math.min(10000, Math.floor((cur / dur) * 10000))) : 0;

        sendAnalytics([
          {
            type: "PROGRESS",
            deltaSec,
            positionSec: cur,
            durationSec: dur,
            watchPctBp,
          },
        ]);
      }
    };
    const onPlay = () => {
      setPlaying(true);
      if (videoId && !viewPingedRef.current) {
        viewPingedRef.current = true;
        fetch("/api/views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId }) }).catch(() => {});
      }

      // Start event (for analytics unique views / A/B testing)
      lastTimeRef.current = v.currentTime || 0;
      playedAccRef.current = 0;
      sendAnalytics([{ type: "VIEW_START", positionSec: v.currentTime || 0, durationSec: v.duration || 0 }]);
    };
    const onPause = () => setPlaying(false);

    const onEnded = () => {
      const cur = v.currentTime || 0;
      const dur = v.duration || 0;
      const watchPctBp = dur > 0 ? Math.max(0, Math.min(10000, Math.floor((cur / dur) * 10000))) : 0;
      sendAnalytics([{ type: "COMPLETE", positionSec: cur, durationSec: dur, watchPctBp }]);
      try {
        window.dispatchEvent(
          new CustomEvent("videoshare:player-ended", { detail: { videoId: videoId ?? null } }),
        );
      } catch {}
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, [scrubbing, analyticsEnabled, videoId, analytics?.experimentId, analytics?.variantId]);

  function computePreviewPos(valSec: number) {
    const input = rangeRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const pct = duration > 0 ? clamp(valSec / duration, 0, 1) : 0;
    const x = rect.left + pct * rect.width;
    // previewLeft is relative to wrapper
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (!wrap) return;
    setPreviewLeft(x - wrap.left);
  }

  function seekTo(sec: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = clamp(sec, 0, duration || 0);
  }

  const frame = useMemo(() => {
    if (!sbEnabled || !sb) return null;
    const idx = clamp(Math.floor((scrubbing ? current : current) * 1000 / sb.intervalMs), 0, sb.count - 1);
    const col = idx % sb.cols;
    const row = Math.floor(idx / sb.cols);
    return { idx, col, row };
  }, [sbEnabled, sb, current, scrubbing]);

  const previewH = useMemo(() => {
    if (!sb) return 90;
    return previewW * (sb.frameH / sb.frameW);
  }, [previewW, sb]);

  const showControls = mode === "standard" || mode === "tiktok";

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <video
        ref={videoRef}
        playsInline
        preload={preload}
        crossOrigin="anonymous"
        poster={poster}
        muted={muted ?? (mode === "tiktok")}
        loop={loop ?? (mode === "tiktok")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: mode === "tiktok" ? "contain" : "contain",
          background: "#000",
        }}
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }}
      />

      <SuperThanksStickerOverlay videoId={videoId} />

      {/* Controls */}
      {showControls ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 10, background: "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0))" }}>
          {/* Storyboard preview when scrubbing */}
          {scrubbing && sbEnabled && sb && frame ? (
            <div
              style={{
                position: "absolute",
                bottom: 46,
                left: clamp(previewLeft - previewW / 2, 10, (wrapRef.current?.getBoundingClientRect().width ?? 0) - previewW - 10),
                width: previewW,
                height: previewH,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                backgroundImage: `url(${sb.url})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${sb.cols * previewW}px ${sb.rows * previewH}px`,
                backgroundPosition: `-${frame.col * previewW}px -${frame.row * previewH}px`,
              }}
            >
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, fontSize: 12, padding: "6px 8px", background: "rgba(0,0,0,0.55)", color: "#fff" }}>
                {fmt(current)} / {fmt(duration)}
              </div>
            </div>
          ) : null}

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) v.play().catch(() => {});
                else v.pause();
              }}
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              {playing ? "Pause" : "Play"}
            </button>

            <div style={{ color: "#fff", fontSize: 12, minWidth: 92, opacity: 0.9 }}>
              {fmt(current)} / {fmt(duration)}
            </div>

            <input
              ref={rangeRef}
              type="range"
              min={0}
              max={Math.max(0.001, duration)}
              step={0.05}
              value={current}
              onChange={(e) => {
                const sec = Number(e.target.value);
                setCurrent(sec);
                computePreviewPos(sec);
                if (!scrubbing) seekTo(sec);
              }}
              onPointerDown={(e) => {
                setScrubbing(true);
                const sec = Number((e.target as HTMLInputElement).value);
                computePreviewPos(sec);
              }}
              onPointerUp={(e) => {
                const sec = Number((e.target as HTMLInputElement).value);
                seekTo(sec);
                setScrubbing(false);
              }}
              onTouchStart={(e) => {
                setScrubbing(true);
                const sec = Number((e.target as HTMLInputElement).value);
                computePreviewPos(sec);
              }}
              onTouchEnd={(e) => {
                const sec = Number((e.target as HTMLInputElement).value);
                seekTo(sec);
                setScrubbing(false);
              }}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}