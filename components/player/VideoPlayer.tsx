"use client";

import Hls from "hls.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import SuperThanksStickerOverlay from "@/components/superthanks/SuperThanksStickerOverlay";
import { Select } from "@/components/ui/select";

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

function rewriteM3u8ToAbsolute(m3u8Text: string, baseUrl: string) {
  // Rewrite relative URIs inside playlists to absolute URLs rooted at the current origin.
  // This helps avoid mixed-origin issues when switching between mirrors.
  const lines = String(m3u8Text || "").split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith("#")) {
      out.push(line);
      continue;
    }
    // Already absolute (http(s)://, data:, blob:)
    if (/^(https?:)?\/\//i.test(s) || /^data:/i.test(s) || /^blob:/i.test(s)) {
      out.push(line);
      continue;
    }
    try {
      const abs = new URL(s, baseUrl).toString();
      out.push(abs);
    } catch {
      out.push(line);
    }
  }
  return out.join("\n");
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
  candidates,
  p2pEnabled,
}: {
  videoId?: string;
  src: string;
  // Optional: ordered playback candidates for failover (R2 A/B, FTP mirror)
  candidates?: Array<{ url: string; origin?: string }>;
  // Optional: P2P segments (requires p2p-media-loader-hlsjs installed). PUBLIC only.
  p2pEnabled?: boolean;
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

  const hlsRef = useRef<Hls | null>(null);
  const lastPlaybackRef = useRef<{ t: number; wasPlaying: boolean } | null>(null);
  const switchStateRef = useRef<{ idx: number; retries: number; lastSwitchAt: number }>({ idx: 0, retries: 0, lastSwitchAt: 0 });

  const sourceList = useMemo(() => (candidates && candidates.length ? candidates : [{ url: src, origin: "R2" }]), [candidates, src]);
  const [activeSrc, setActiveSrc] = useState(() => (candidates && candidates.length ? candidates[0]!.url : src));
  const [activeOrigin, setActiveOrigin] = useState<string>(() => (candidates && candidates.length ? String(candidates[0]!.origin || "") : ""));

  const [levels, setLevels] = useState<Array<{ idx: number; height: number; bitrate: number }>>([]);
  const [quality, setQuality] = useState<string>(() => {
    if (typeof window === "undefined") return "auto";
    try {
      return localStorage.getItem("videoshare:player:quality:v1") || "auto";
    } catch {
      return "auto";
    }
  });
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsText, setStatsText] = useState<string>("");

  const [theater, setTheater] = useState(false);
  const [mini, setMini] = useState(false);
  const [pipActive, setPipActive] = useState(false);

  const [fatalOverlay, setFatalOverlay] = useState<string | null>(null);
  const switchToNextRef = useRef<(reason: string) => void>(() => {});
  const switchesRef = useRef<{ count: number; startedAt: number }>({ count: 0, startedAt: 0 });

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
  const p2pFlag = Boolean(p2pEnabled);

  useEffect(() => {
    try {
      localStorage.setItem("videoshare:player:quality:v1", quality);
    } catch {
      // ignore
    }
    const hls = hlsRef.current;
    if (!hls) return;
    if (quality === "auto") {
      hls.currentLevel = -1;
      return;
    }
    const wanted = Number(quality);
    if (!Number.isFinite(wanted)) return;
    // pick closest height
    const list = levels.length ? levels : hls.levels.map((lv, idx) => ({ idx, height: Number(lv.height || 0), bitrate: Number(lv.bitrate || 0) })).filter((x) => x.height > 0);
    if (!list.length) return;
    let best = list[0];
    for (const lv of list) {
      if (Math.abs(lv.height - wanted) < Math.abs(best.height - wanted)) best = lv;
    }
    hls.currentLevel = best.idx;
  }, [quality, levels]);

  useEffect(() => {
    if (!statsOpen) return;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      const hls = hlsRef.current;
      if (!v) return;
      const bufEnd = v.buffered && v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
      const bufLen = Math.max(0, bufEnd - (v.currentTime || 0));
      const dropped = (v as any).getVideoPlaybackQuality ? (v as any).getVideoPlaybackQuality().droppedVideoFrames : undefined;
      const total = (v as any).getVideoPlaybackQuality ? (v as any).getVideoPlaybackQuality().totalVideoFrames : undefined;
      let rendition = "";
      let bw = "";
      if (hls) {
        const lvl = hls.currentLevel;
        const cur = lvl >= 0 ? hls.levels[lvl] : null;
        rendition = cur?.height ? `${cur.height}p` : (lvl === -1 ? "Auto" : "");
        bw = hls.bandwidthEstimate ? `${Math.round(hls.bandwidthEstimate / 1000)} kbps` : "";
      }
      setStatsText([
        `Origin: ${activeOrigin || "R2"}`,
        `P2P: ${p2pFlag ? "enabled" : "off"}`,
        rendition ? `Rendition: ${rendition}` : "Rendition: (unknown)",
        bw ? `Bandwidth est: ${bw}` : "Bandwidth est: (unknown)",
        `Buffer: ${bufLen.toFixed(2)}s`,
        dropped != null && total != null ? `Dropped frames: ${dropped}/${total}` : "Dropped frames: (n/a)",
      ].join("\n"));
    }, 1000);
    return () => window.clearInterval(id);
  }, [statsOpen, activeOrigin]);

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

  // Attach HLS (only when src is an HLS playlist). Supports failover via `candidates`.
useEffect(() => {
  const video = videoRef.current;
  if (!video) return;

  const first = sourceList[0]?.url || src;
  const firstOrigin = String(sourceList[0]?.origin || "");
  setActiveSrc(first);
  setActiveOrigin(firstOrigin);
  switchStateRef.current = { idx: 0, retries: 0, lastSwitchAt: 0 };

  return () => {
    // nothing
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [src, JSON.stringify(sourceList.map((s) => s.url))]);

useEffect(() => {
  const video = videoRef.current;
  if (!video) return;

  const isHls = /\.m3u8(\?|$)/i.test(activeSrc);
  let hls: Hls | null = null;

  function destroy() {
    try {
      hlsRef.current?.destroy();
    } catch {
      // ignore
    }
    hlsRef.current = null;
    try {
      hls?.destroy();
    } catch {
      // ignore
    }
    hls = null;
  }

  function applyQualityPref(h: Hls) {
    if (!levels.length) return;
    if (quality === "auto") {
      h.currentLevel = -1;
      return;
    }
    const wanted = Number(quality);
    if (!Number.isFinite(wanted)) return;
    // pick closest height
    let best = levels[0];
    for (const lv of levels) {
      if (Math.abs(lv.height - wanted) < Math.abs(best.height - wanted)) best = lv;
    }
    h.currentLevel = best.idx;
  }

  function switchToNext(reason: string) {
    const now = Date.now();
    const st = switchStateRef.current;
    if (sourceList.length <= 1) return;

    // Backoff + prevent rapid thrash
    if (now - st.lastSwitchAt < 1500) return;
    st.lastSwitchAt = now;

    const nextIdx = (st.idx + 1) % sourceList.length;
    st.idx = nextIdx;

    // Track how many mirror switches we've tried in a short window. If exhausted, show overlay.
    const win = switchesRef.current;
    if (!win.startedAt || now - win.startedAt > 30_000) {
      win.startedAt = now;
      win.count = 0;
    }
    win.count += 1;
    if (win.count >= Math.max(2, sourceList.length * 2)) {
      setFatalOverlay(`Playback error. Tried multiple mirrors but still failing. Last error: ${reason}`);
    }

    lastPlaybackRef.current = { t: video.currentTime || 0, wasPlaying: !video.paused };
    const next = sourceList[nextIdx];
    setActiveSrc(next.url);
    setActiveOrigin(String(next.origin || ""));
    setStatsText((prev) => prev); // keep
    // Reset retry count after a successful switch attempt
    st.retries = 0;

    // Surface banner in stats overlay when open
    if (statsOpen) {
      setStatsText((prev) => prev + `
Switch origin → ${String(next.origin || "UNKNOWN")} (${reason})`);
    }
  }

  // Expose for Error overlay button.
  switchToNextRef.current = switchToNext;

  // Non-HLS: just set src
  if (!isHls) {
    destroy();
    video.src = activeSrc;
    return;
  }

  // Native HLS (Safari)
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    destroy();
    video.src = activeSrc;
    return;
  }

  if (!Hls.isSupported()) {
    destroy();
    video.src = activeSrc;
    return;
  }

  // Custom loader: rewrite playlists to absolute URLs (same origin as the playlist URL).
  const DefaultLoader = (Hls as any).DefaultConfig.loader;
  class ManifestRewritingLoader {
    inner: any;
    constructor(config: any) {
      this.inner = new DefaultLoader(config);
    }
    destroy() {
      try { this.inner.destroy(); } catch {}
    }
    abort() {
      try { this.inner.abort(); } catch {}
    }
    load(context: any, config: any, callbacks: any) {
      const wrapped = {
        ...callbacks,
        onSuccess: (response: any, stats: any, ctx: any, networkDetails: any) => {
          try {
            const t = String(ctx?.type || "");
            if ((t === "manifest" || t === "level") && typeof response?.data === "string") {
              response.data = rewriteM3u8ToAbsolute(response.data, ctx?.url || activeSrc);
            }
          } catch {}
          callbacks.onSuccess(response, stats, ctx, networkDetails);
        },
      };
      this.inner.load(context, config, wrapped);
    }
  }

  destroy();
  hls = new Hls({
    enableWorker: true,
    // Conservative defaults; failover handled at app layer
    fragLoadingRetryDelay: 500,
    manifestLoadingRetryDelay: 500,
    levelLoadingRetryDelay: 500,
    loader: ManifestRewritingLoader as any,
  });
  hlsRef.current = hls;
  hls.loadSource(activeSrc);
  hls.attachMedia(video);

  const onManifest = () => {
    // Successful manifest load clears any prior fatal overlay and resets mirror switch window.
    setFatalOverlay(null);
    switchesRef.current = { count: 0, startedAt: Date.now() };

    // Build quality list (unique heights)
    const uniq = new Map<number, { idx: number; height: number; bitrate: number }>();
    hls!.levels.forEach((lv, idx) => {
      const h = Number(lv.height || 0);
      if (!h) return;
      if (!uniq.has(h)) uniq.set(h, { idx, height: h, bitrate: Number(lv.bitrate || 0) });
    });
    const arr = Array.from(uniq.values()).sort((a, b) => b.height - a.height);
    setLevels(arr);

    // Re-apply playback position after switch
    const last = lastPlaybackRef.current;
    if (last) {
      lastPlaybackRef.current = null;
      try {
        video.currentTime = Math.max(0, last.t);
      } catch {
        // ignore
      }
      if (last.wasPlaying) video.play().catch(() => {});
    }

    // Apply stored quality preference
    window.setTimeout(() => {
      try {
        applyQualityPref(hls!);
      } catch {
        // ignore
      }
    }, 0);
  };

  // Optional prefetch: warm the browser cache for the next 1–2 segments (light, rate-limited).
  const prefetched = new Set<string>();
  let lastPrefetchAt = 0;

  async function prefetchUrl(url: string) {
    const now = Date.now();
    // Rate-limit (at most once per ~800ms)
    if (now - lastPrefetchAt < 800) return;
    lastPrefetchAt = now;
    if (prefetched.has(url)) return;
    prefetched.add(url);
    try {
      // Ignore response; the goal is to populate the HTTP cache.
      await fetch(url, { method: "GET", credentials: "omit" as any, cache: "force-cache" as any });
    } catch {
      // ignore
    }
  }

  const onFragLoaded = (_: any, data: any) => {
    try {
      const frag = data?.frag;
      const levelIdx = Number(frag?.level ?? hls?.currentLevel ?? -1);
      if (!hls || levelIdx < 0) return;
      const details = (hls.levels?.[levelIdx] as any)?.details;
      const frags = details?.fragments as any[] | undefined;
      const sn = Number(frag?.sn);
      if (!frags || !Number.isFinite(sn)) return;
      const idx = frags.findIndex((f) => Number(f?.sn) === sn);
      if (idx < 0) return;
      const next = frags.slice(idx + 1, idx + 3);
      for (const f of next) {
        const u = String(f?.url || f?.relurl || "");
        if (u) void prefetchUrl(u);
      }
    } catch {
      // ignore
    }
  };

  const onError = (_: any, data: any) => {
    if (!data?.fatal) return;

    const st = switchStateRef.current;
    st.retries = (st.retries || 0) + 1;

    if (data.type === Hls.ErrorTypes.MEDIA_ERROR && st.retries <= 2) {
      try {
        hls!.recoverMediaError();
        return;
      } catch {
        // fall through to switch
      }
    }

    // Try a couple of quick retries before switching origin
    if (st.retries <= 2) {
      const delay = Math.min(4000, 500 * Math.pow(2, st.retries));
      window.setTimeout(() => {
        try {
          hls!.startLoad();
        } catch {
          switchToNext(`${data.type || "ERROR"}`);
        }
      }, delay);
      return;
    }

    switchToNext(`${data.type || "ERROR"}`);
  };

  hls.on(Hls.Events.MANIFEST_PARSED, onManifest);
  hls.on(Hls.Events.FRAG_LOADED, onFragLoaded);
  hls.on(Hls.Events.ERROR, onError);

  return () => {
    try {
      hls?.off(Hls.Events.MANIFEST_PARSED, onManifest);
      hls?.off(Hls.Events.FRAG_LOADED, onFragLoaded);
      hls?.off(Hls.Events.ERROR, onError);
    } catch {
      // ignore
    }
    destroy();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeSrc]);
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


// Mini-player: when playing and scrolled out of view, pin to corner (PeerTube-ish).
useEffect(() => {
  const el = wrapRef.current;
  if (!el) return;
  if (theater || pipActive) return;
  let lastIntersect = true;
  const obs = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      if (!e) return;
      lastIntersect = e.isIntersecting;
      // Enable mini only when currently playing and out of view.
      if (!e.isIntersecting && playing) setMini(true);
      if (e.isIntersecting) setMini(false);
    },
    { threshold: 0.2 }
  );
  obs.observe(el);
  return () => {
    try { obs.disconnect(); } catch {}
  };
}, [playing, theater, pipActive]);

// Picture-in-Picture events
useEffect(() => {
  const v = videoRef.current;
  if (!v) return;
  const onEnter = () => setPipActive(true);
  const onLeave = () => setPipActive(false);
  v.addEventListener("enterpictureinpicture", onEnter as any);
  v.addEventListener("leavepictureinpicture", onLeave as any);
  return () => {
    v.removeEventListener("enterpictureinpicture", onEnter as any);
    v.removeEventListener("leavepictureinpicture", onLeave as any);
  };
}, []);

// Hotkeys (PeerTube-ish): J/K/L, arrows, M, F. Ignore when typing in inputs.
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const ae = document.activeElement as HTMLElement | null;
    const tag = (ae?.tagName || "").toLowerCase();
    const isTyping =
      tag === "input" ||
      tag === "textarea" ||
      (ae && (ae as any).isContentEditable);

    if (isTyping) return;

    const v = videoRef.current;
    if (!v) return;

    const key = e.key.toLowerCase();
    if (key === "k" || key === " ") {
      e.preventDefault();
      if (v.paused) v.play().catch(() => {});
      else v.pause();
      return;
    }
    if (key === "j") {
      e.preventDefault();
      v.currentTime = Math.max(0, (v.currentTime || 0) - 10);
      return;
    }
    if (key === "l") {
      e.preventDefault();
      v.currentTime = Math.min(v.duration || Infinity, (v.currentTime || 0) + 10);
      return;
    }
    if (key === "arrowleft") {
      e.preventDefault();
      v.currentTime = Math.max(0, (v.currentTime || 0) - 5);
      return;
    }
    if (key === "arrowright") {
      e.preventDefault();
      v.currentTime = Math.min(v.duration || Infinity, (v.currentTime || 0) + 5);
      return;
    }
    if (key === "m") {
      e.preventDefault();
      v.muted = !v.muted;
      return;
    }
    if (key === "f") {
      e.preventDefault();
      setTheater((t) => !t);
      return;
    }
  };

  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
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

  const containerStyle: React.CSSProperties = theater
    ? { position: "fixed", inset: 0, zIndex: 60, background: "#000", padding: 8 }
    : mini
      ? { position: "fixed", bottom: 16, right: 16, width: 360, height: 202, zIndex: 60, borderRadius: 16, overflow: "hidden", background: "#000", boxShadow: "0 12px 30px rgba(0,0,0,0.45)" }
      : { width: "100%", height: "100%", position: "relative" };

  return (
    <div ref={wrapRef} style={containerStyle}>
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


{/* Theater / Mini controls */}
{(theater || mini) ? (
  <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 8, zIndex: 70 }}>
    <button
      type="button"
      onClick={() => {
        if (theater) setTheater(false);
        if (mini) setMini(false);
      }}
      style={{ background: "rgba(0,0,0,0.65)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 999, padding: "6px 10px", fontSize: 12 }}
    >
      {theater ? "Exit theater" : "Close mini-player"}
    </button>
  </div>
) : null}

      {fatalOverlay ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.55)",
            padding: 16,
          }}
        >
          <div style={{ maxWidth: 520, width: "100%", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.75)" }}>
            <div style={{ padding: 14, color: "#fff", fontSize: 14, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Playback error</div>
              <div style={{ opacity: 0.9 }}>{fatalOverlay}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setFatalOverlay(null);
                    switchesRef.current = { count: 0, startedAt: Date.now() };
                    switchToNextRef.current?.("MANUAL");
                  }}
                  style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 10px" }}
                >
                  Try another mirror
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFatalOverlay(null);
                    switchesRef.current = { count: 0, startedAt: Date.now() };
                    const v = videoRef.current;
                    if (v) {
                      try {
                        v.load();
                        v.play().catch(() => {});
                      } catch {}
                    }
                  }}
                  style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: "8px 10px" }}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}


{/* Origin banner (when switched from primary) */}
{activeOrigin && sourceList[0] && activeOrigin !== String(sourceList[0].origin || "") ? (
  <div style={{ position: "absolute", top: 10, right: 10, padding: "6px 10px", borderRadius: 999, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 12 }}>
    Playing from {activeOrigin}
  </div>
) : null}

{/* Stats overlay */}
{statsOpen ? (
  <div style={{ position: "absolute", top: 10, left: 10, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 12, whiteSpace: "pre-line", maxWidth: 360 }}>
    {statsText || "Loading stats..."}
  </div>
) : null}

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


            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setStatsOpen((s) => !s)}
                style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                {statsOpen ? "Hide stats" : "Stats"}
              </button>


<button
  type="button"
  onClick={async () => {
    const v = videoRef.current as any;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        // @ts-ignore
        await document.exitPictureInPicture();
      } else if (v.requestPictureInPicture) {
        await v.requestPictureInPicture();
      }
    } catch {}
  }}
  style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
>
  PiP
</button>

<button
  type="button"
  onClick={() => {
    setMini(false);
    setTheater((t) => !t);
  }}
  style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
>
  {theater ? "Exit" : "Theater"}
</button>

              {levels.length ? (
                <Select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="h-8 w-[110px] rounded-lg bg-white/90 text-black"
                  aria-label="Quality"
                >
                  <option value="auto">Auto</option>
                  {levels.map((lv) => (
                    <option key={lv.height} value={String(lv.height)}>
                      {lv.height}p
                    </option>
                  ))}
                </Select>
              ) : null}
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