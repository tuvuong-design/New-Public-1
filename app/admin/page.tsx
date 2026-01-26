import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [users, videos, processing] = await Promise.all([
    prisma.user.count(),
    prisma.video.count(),
    prisma.video.count({ where: { status: "PROCESSING" } }),
  ]);

  const latest = await prisma.video.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, title: true, status: true, createdAt: true },
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="row">
        <div className="card">Users: <b>{users}</b></div>
        <div className="card">Videos: <b>{videos}</b></div>
        <div className="card">Processing: <b>{processing}</b></div>
      </div>

<div className="card">
  <div style={{ fontWeight: 700 }}>Quick admin links</div>
  <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 8 }}>
    <a className="ghost" href="/admin/reports">Reports</a>
    <a className="ghost" href="/admin/boost/plans">Boost plans</a>
    <a className="ghost" href="/admin/boost/orders">Boost orders</a>
    <a className="ghost" href="/admin/ads">Ads</a>
    <a className="ghost" href="/admin/gifts">Gifts</a>
    <a className="ghost" href="/admin/stars">Stars</a>
  </div>
</div>

      <div className="card">
        <div style={{ fontWeight: 700 }}>Latest videos</div>
        <ul>
          {latest.map((v) => (
            <li key={v.id}>
              <a href={`/admin/videos/${v.id}`}>{v.title}</a> <span className="small muted">({v.status})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
