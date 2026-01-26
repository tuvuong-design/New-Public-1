import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSubtitles() {
  const list = await prisma.subtitle.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { video: { select: { title: true, id: true } } },
  });

  return (
    <div className="card">
      <div style={{ fontWeight: 700 }}>Subtitles (200 latest)</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Video</th>
            <th align="left">Lang</th>
            <th align="left">Provider</th>
            <th align="left">Created</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id} style={{ borderTop: "1px solid #eee" }}>
              <td><a href={`/admin/videos/${s.videoId}`}>{s.video.title}</a></td>
              <td>{s.lang}</td>
              <td>{s.provider}</td>
              <td className="small muted">{new Date(s.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
