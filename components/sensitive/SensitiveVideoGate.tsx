"use client";

import { useState } from "react";
import Link from "next/link";
import VideoPlayer from "@/components/player/VideoPlayer";

export type SensitiveMode = "SHOW" | "BLUR" | "HIDE";

type Storyboard = {
  enabled: boolean;
  url: string | null;
  frameW?: number | null;
  frameH?: number | null;
  cols?: number | null;
  rows?: number | null;
  count?: number | null;
  intervalMs?: number | null;
};

export default function SensitiveVideoGate({
  mode,
  hlsUrl,
  poster,
  title,
  playerMode,
  storyboard,
  videoId,
  analytics,
  candidates,
  p2pEnabled,
}: {
  mode: SensitiveMode;
  hlsUrl: string;
  poster?: string;
  title: string;
  playerMode?: "standard" | "tiktok";
  storyboard?: Storyboard;
  videoId?: string;
  analytics?: { experimentId?: string | null; variantId?: string | null } | null;
  candidates?: Array<{ url: string; origin?: string }>;
  p2pEnabled?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  if (mode === "SHOW" || revealed) {
    return <VideoPlayer videoId={videoId} src={hlsUrl} candidates={candidates} poster={poster} mode={playerMode} storyboard={storyboard} analytics={analytics} p2pEnabled={p2pEnabled} />;
  }

  const blur = mode === "BLUR";

  return (
    <div className="relative w-full overflow-hidden rounded-2xl">
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt={title}
          className={`h-full w-full object-cover ${blur ? "blur-xl" : ""}`}
          loading="lazy"
        />
      ) : (
        <div className={`h-[320px] w-full bg-zinc-900 ${blur ? "blur-xl" : ""}`} />
      )}

      <div className="absolute inset-0 grid place-items-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white/95 p-4 shadow-lg">
          <div className="text-lg font-extrabold">Nội dung nhạy cảm</div>
          <div className="small muted mt-1">
            Video này có thể không phù hợp với mọi đối tượng. Bạn có thể thay đổi chế độ hiển thị (Hiển thị / Làm mờ / Ẩn)
            trong phần cài đặt cá nhân.
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn" type="button" onClick={() => setRevealed(true)}>
              Tôi hiểu và muốn xem
            </button>
            <Link className="btn btn-muted" href="/me/settings">
              Cài đặt
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
