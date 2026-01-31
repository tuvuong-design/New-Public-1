import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export const runtime = "nodejs";
// OpenGraph image for /u/[id] (creator profile).
//
// Shows avatar + name + stats lite. No sensitive media.

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      _count: { select: { videos: true, subscribers: true } },
    },
  });

  if (!u) return new Response("Not found", { status: 404 });

  const displayName = u.name || (u.username ? `@${u.username}` : "Creator");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          color: "white",
          background: "linear-gradient(135deg, #0b1220, #1a2336)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "26px" }}>
          {u.image ? (
            <img
              src={resolveMediaUrl(u.image)}
              width={132}
              height={132}
              style={{ borderRadius: 999, border: "3px solid rgba(255,255,255,.35)" }}
            />
          ) : (
            <div
              style={{
                width: 132,
                height: 132,
                borderRadius: 999,
                background: "rgba(255,255,255,.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 52,
              }}
            >
              👤
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
              {displayName}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 22, opacity: 0.86 }}>
              <div>{u._count?.videos ?? 0} videos</div>
              <div style={{ opacity: 0.6 }}>•</div>
              <div>{u._count?.subscribers ?? 0} followers</div>
            </div>
            <div style={{ marginTop: 18, fontSize: 20, opacity: 0.72 }}>VideoShare</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
