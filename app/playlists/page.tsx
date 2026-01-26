import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import CreatePlaylistForm from "./ui/CreatePlaylistForm";

export const dynamic = "force-dynamic";

export default async function PlaylistsPage() {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!uid) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="card">
          <div className="text-lg font-extrabold">Playlists</div>
          <div className="small muted mt-1">Vui lòng đăng nhập để quản lý playlists.</div>
          <div className="mt-3"><a className="btn" href="/login">Login</a></div>
        </div>
      </main>
    );
  }

  const playlists = await prisma.playlist.findMany({
    where: { ownerId: uid },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      visibility: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
    take: 200,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="text-lg font-extrabold">Playlists</div>
            <div className="small muted mt-1">Tạo playlist để lưu video và chia sẻ.</div>
          </div>
          <a className="btn" href="/">Home</a>
        </div>
      </div>

      <CreatePlaylistForm />

      <div className="card">
        {playlists.length === 0 ? (
          <div className="small muted">Chưa có playlist.</div>
        ) : (
          <div className="space-y-2">
            {playlists.map((p) => (
              <div key={p.id} className="card" style={{ border: "1px solid #eee" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      <Link href={`/p/${p.id}`}>{p.title}</Link>
                    </div>
                    <div className="small muted">
                      {p.visibility} • {p._count.items} videos • updated {new Date(p.updatedAt).toLocaleString()}
                    </div>
                    {p.description ? (
                      <div className="small" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{p.description}</div>
                    ) : null}
                  </div>
                  <Link className="btn" href={`/p/${p.id}`}>Open</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
