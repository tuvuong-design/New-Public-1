"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VideoPlayer from "@/components/player/VideoPlayer";
import ScopedAdSlot from "@/components/ads/ScopedAdSlot";
import SensitiveVideoGate, { type SensitiveMode } from "@/components/sensitive/SensitiveVideoGate";
import CommunityPoll from "@/components/community/CommunityPoll";
import Link from "next/link";

export type VideoItem = {
  kind: "video";
  id: string;
  title: string;
  hlsUrl: string;
  posterUrl: string | null;
  poster?: string | null; // backward compatible alias
  isSensitive: boolean;
  sponsored?: boolean;
  storyboard?: {
    enabled: boolean;
    url: string | null;
    frameW?: number | null;
    frameH?: number | null;
    cols?: number | null;
    rows?: number | null;
    count?: number | null;
  };
};

export type AdItem = {
  kind: "ad";
  id: string;
  scope: "FEED" | "COMMENTS" | "VIDEO" | "RELATED" | "GLOBAL_TOP" | "GLOBAL_BOTTOM";
};

export type CommunityPostItem = {
  kind: "post";
  id: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  type: "TEXT" | "IMAGE" | "GIF" | "POLL" | "YOUTUBE" | "LINK";
  text: string;
  mediaUrl?: string | null;
  linkUrl?: string | null;
  youtubeUrl?: string | null;
  pollOptions?: { id: string; text: string; votes: number }[];
  viewerVotedOptionId?: string | null;
};

export type TikTokItem = VideoItem | AdItem | CommunityPostItem;

export default function TikTokVerticalFeed({
  items,
  header,
  showHeader,
  sensitiveMode,
}: {
  items: TikTokItem[];
  header?: React.ReactNode;
  showHeader?: boolean;
  sensitiveMode?: SensitiveMode;
}) {
  const mode = sensitiveMode ?? "BLUR";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const observedIds = useMemo(() => items.filter((i) => i.kind === "video").map((i) => i.id), [items]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-video-id]"));
    if (!targets.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        // choose the entry with highest intersection ratio
        let best: { id: string; ratio: number } | null = null;
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.videoId;
          if (!id) continue;
          if (e.isIntersecting) {
            if (!best || e.intersectionRatio > best.ratio) {
              best = { id, ratio: e.intersectionRatio };
            }
          }
        }
        if (best) setActiveId(best.id);
      },
      { threshold: [0.25, 0.5, 0.75, 0.9] }
    );

    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, [observedIds]);

  return (
    <div style={{ height: showHeader ? "calc(100vh - 170px)" : "100vh" }}>
      {showHeader && header ? <div style={{ height: 140 }}>{header}</div> : null}

      <div
        ref={containerRef}
        style={{
          height: showHeader ? "calc(100vh - 210px)" : "100vh",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
        }}
      >
        {items.map((it, idx) => {
          if (it.kind === "ad") {
            return (
              <div
                key={`ad:${it.scope}:${it.id}:${idx}`}
                style={{
                  scrollSnapAlign: "start",
                  height: showHeader ? "calc(100vh - 210px)" : "100vh",
                  display: "grid",
                  placeItems: "center",
                  background: "#000",
                }}
              >
                <div style={{ width: "min(720px, 100%)", padding: 16 }}>
                  <ScopedAdSlot scope={it.scope} />
                </div>
              </div>
            );
          }

          if (it.kind === "post") {
            const p = it;
            return (
              <div
                key={`post:${p.id}:${idx}`}
                style={{
                  scrollSnapAlign: "start",
                  height: showHeader ? "calc(100vh - 210px)" : "100vh",
                  display: "grid",
                  placeItems: "center",
                  background: "#000",
                }}
              >
                <div style={{ width: "min(720px, 100%)", padding: 16 }}>
                  <div className="card space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/u/${p.authorId}`} className="font-semibold">
                        {p.authorName}
                      </Link>
                      <span className="small muted">{new Date(p.createdAt).toLocaleString()}</span>
                    </div>

                    {p.text ? <div className="small whitespace-pre-wrap">{p.text}</div> : null}

                    {p.youtubeUrl ? (
                      <a className="small underline" href={p.youtubeUrl} target="_blank" rel="noreferrer">
                        YouTube
                      </a>
                    ) : null}

                    {p.linkUrl ? (
                      <a className="small underline" href={p.linkUrl} target="_blank" rel="noreferrer">
                        Mở link
                      </a>
                    ) : null}

                    {p.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.mediaUrl} alt="" className="w-full rounded-lg" />
                    ) : null}

                    {p.pollOptions && p.pollOptions.length ? (
                      <CommunityPoll
                        postId={p.id}
                        options={p.pollOptions}
                        viewerVotedOptionId={p.viewerVotedOptionId ?? null}
                      />
                    ) : null}

                    <div className="small muted">Community post</div>
                  </div>
                </div>
              </div>
            );
          }

          const v = it as VideoItem;

          return (
            <div
              key={`video:${v.id}:${idx}`}
              data-video-id={v.id}
              style={{
                scrollSnapAlign: "start",
                height: showHeader ? "calc(100vh - 210px)" : "100vh",
                position: "relative",
                background: "#000",
              }}
            >
              <div style={{ position: "absolute", top: 12, left: 12, zIndex: 20 }}>
                {v.sponsored ? (
                  <div className="badge badge-yellow">Sponsored</div>
                ) : null}
              </div>

              <div style={{ height: "100%" }}>
                {v.isSensitive && mode !== "SHOW" ? (
                  <SensitiveVideoGate
                    mode={mode}
                    hlsUrl={v.hlsUrl}
                    poster={v.posterUrl ?? v.poster ?? undefined}
                    title={v.title}
                    playerMode="tiktok"
                    storyboard={v.storyboard}
                  />
                ) : (
                  <VideoPlayer
                    src={v.hlsUrl}
                    poster={v.posterUrl ?? v.poster ?? undefined}
                    title={v.title}
                    mode="tiktok"
                    storyboard={v.storyboard}
                  />
                )}
              </div>

              {/* keep activeId to prevent autoplay weirdness (future use) */}
              <div style={{ display: "none" }}>{activeId}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatBubble({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: "center", fontSize: 12 }}>
      <div style={{ fontSize: 22, lineHeight: 1 }}>{label}</div>
      <div style={{ opacity: 0.9 }}>{value}</div>
    </div>
  );
}
