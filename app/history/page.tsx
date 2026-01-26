import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSensitiveModeForUser } from "@/lib/sensitive";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import SensitiveThumb from "@/components/sensitive/SensitiveThumb";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!uid) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="card">
          <div className="text-lg font-extrabold">History</div>
          <div className="small muted mt-1">Vui lòng đăng nhập để xem lịch sử.</div>
          <div className="mt-3"><a className="btn" href="/login">Login</a></div>
        </div>
      </main>
    );
  }

  const sensitiveMode = await getSensitiveModeForUser(uid);

  const rows = await prisma.videoProgress.findMany({
    where: { userId: uid },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { video: true },
  });

  const items = rows.filter((r) => r.video && (r.video as any).status === "PUBLISHED");

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="text-lg font-extrabold">History</div>
            <div className="small muted mt-1">Tiếp tục xem các video bạn đã xem.</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <a className="btn" href="/playlists">Playlists</a>
            <a className="btn" href="/">Home</a>
          </div>
        </div>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="small muted">Chưa có lịch sử xem.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {items.map((p) => {
              const v: any = p.video;
              return (
                <div key={p.id} className="card">
                  <a href={`/v/${v.id}?t=${p.seconds}`}>
                    <div style={{ fontWeight: 800 }}>{v.title}</div>
                    <div className="small muted">
                      {p.seconds}s • {new Date(p.updatedAt).toLocaleString()}
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
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 8, background: "#eee", borderRadius: 999, overflow: "hidden" }}>
                      <div
                        style={{
                          height: 8,
                          width: `${Math.max(0, Math.min(100, Math.floor(((p.seconds ?? 0) / Math.max(1, (v.durationSec ?? 600))) * 100)))}%`,
                          background: "#111",
                        }}
                      />
                    </div>
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
