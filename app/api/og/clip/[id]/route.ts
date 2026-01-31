import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export const runtime = "nodejs";
// OpenGraph image for /clip/[id].
//
// Shows clip title + creator + source video context.
// If the source video is sensitive, we avoid showing the thumbnail.

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const clip = await prisma.clip.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      status: true,
      outputKey: true,
      video: { select: { id: true, title: true, isSensitive: true, thumbKey: true } },
      creator: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  if (!clip) return new Response("Not found", { status: 404 });

  const creatorName = clip.creator?.name || (clip.creator?.username ? `@${clip.creator.username}` : "Creator");
  const title = clip.title || `Clip từ: ${clip.video?.title || "Video"}`;

  const isSensitive = Boolean(clip.video?.isSensitive);
  const thumbUrl = !isSensitive ? resolveMediaUrl(clip.video?.thumbKey) : "";

  const bgStyle = thumbUrl
    ? ({ backgroundImage: `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url(${thumbUrl})` } as const)
    : ({ background: "linear-gradient(135deg, #0b1220, #1a2336)" } as const);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "64px",
          color: "white",
          ...bgStyle,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "18px" }}>
          {clip.creator?.image ? (
            <img
              src={resolveMediaUrl(clip.creator.image)}
              width={56}
              height={56}
              style={{ borderRadius: 999, border: "2px solid rgba(255,255,255,.35)" }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: "rgba(255,255,255,.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
              }}
            >
              ▶
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, opacity: 0.92 }}>{creatorName}</div>
            <div style={{ fontSize: 16, opacity: 0.75 }}>
              {clip.video?.title ? `Từ video: ${clip.video.title}` : "Clip"}
            </div>
          </div>

          {isSensitive ? (
            <div
              style={{
                marginLeft: "auto",
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(255,120,120,.18)",
                border: "1px solid rgba(255,120,120,.32)",
                fontSize: 16,
              }}
            >
              Sensitive
            </div>
          ) : null}
        </div>

        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.02em" }}>
          {title}
        </div>

        <div style={{ marginTop: "18px", display: "flex", gap: "10px", alignItems: "center", opacity: 0.8 }}>
          <div style={{ fontSize: 18 }}>
            {clip.status === "READY" ? "Clip • Ready" : "Clip • Processing"}
          </div>
          <div style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(255,255,255,.55)" }} />
          <div style={{ fontSize: 18 }}>VideoShare</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
