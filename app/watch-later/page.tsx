import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSensitiveModeForUser } from "@/lib/sensitive";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import SensitiveThumb from "@/components/sensitive/SensitiveThumb";

export const dynamic = "force-dynamic";

export default async function WatchLaterPage() {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;

  if (!uid) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="card">
          <div className="text-lg font-extrabold">Watch Later</div>
          <div className="small muted mt-1">Vui lòng đăng nhập để xem danh sách xem sau.</div>
          <div className="mt-3">
            <a className="btn" href="/login">Login</a>
          </div>
        </div>
      </main>
    );
  }

  const sensitiveMode = await getSensitiveModeForUser(uid);
  const rows = await prisma.watchLaterItem.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { video: true },
  });
  const items = rows.filter((r) => r.video && (r.video as any).status === "PUBLISHED");
  const progress = await prisma.videoProgress.findMany({
    where: { userId: uid, videoId: { in: items.map((i) => i.videoId) } },
    select: { videoId: true, seconds: true, updatedAt: true },
  });
  const progressByVideo = new Map(progress.map((p) => [p.videoId, p]));

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="text-lg font-extrabold">Watch Later</div>
            <div className="small muted mt-1">Danh sách video bạn muốn xem sau (có thể resume).</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <a className="btn" href="/history">History</a>
            <a className="btn" href="/">Home</a>
          </div>
        </div>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="small muted">Chưa có video trong Watch Later.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {items.map((it) => {
              const v: any = it.video;
              const p = progressByVideo.get(it.videoId);
              const t = Math.max(0, Number(p?.seconds ?? 0));
              return (
                <div key={it.id} className="card">
                  <a href={`/v/${v.id}?t=${t}`}>
                    <div style={{ fontWeight: 800 }}>{v.title}</div>
                    <div className="small muted">
                      {t}s • added {new Date(it.createdAt).toLocaleString()}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        aspectRatio: "16/9",
                        borderRadius: 14,
                        overflow: "hidden",
                        background: "#f3f3f3",
                      }}
                    >
                      <SensitiveThumb
                        src={resolveMediaUrl(v.thumbKey)}
                        alt={v.title}
                        isSensitive={Boolean(v.isSensitive)}
                        mode={sensitiveMode}
                      />
                    </div>
                  </a>

                  <div className="mt-3 row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <form action="/api/me/watch-later/toggle" method="post">
                      <input type="hidden" name="videoId" value={v.id} />
                      <input type="hidden" name="redirect" value="/watch-later" />
                      <button className="btn" type="submit">Remove</button>
                    </form>
                    <a className="btn" href={`/v/${v.id}?t=${t}`}>Watch</a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
