import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export const runtime = "nodejs";

// OpenGraph image for /v/[id].
// - For sensitive videos: show blurred background + warning label
// - For non-sensitive: show thumbnail background when possible

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const v = await prisma.video.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, isSensitive: true, thumbKey: true },
  });

  if (!v) {
    return new Response("Not found", { status: 404 });
  }

  const thumbUrl = resolveMediaUrl(v.thumbKey);
  const isSensitive = Boolean(v.isSensitive);

  const title = v.title || "Video";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 56,
          color: "white",
          background: "linear-gradient(135deg, #111827 0%, #0f172a 100%)",
          position: "relative",
        }}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: isSensitive ? "blur(24px) brightness(0.65)" : "brightness(0.75)",
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.75) 70%, rgba(0,0,0,0.85) 100%)",
          }}
        />

        {isSensitive ? (
          <div
            style={{
              position: "absolute",
              top: 48,
              left: 48,
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 16,
              padding: "12px 18px",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            ⚠ Sensitive content
          </div>
        ) : null}

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.15, maxWidth: 980 }}>
            {title}
          </div>
          <div style={{ fontSize: 26, opacity: 0.9 }}>VideoShare</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
