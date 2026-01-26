import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  const list = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="card">
      <div style={{ fontWeight: 700 }}>Users (200 latest)</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Email</th>
            <th align="left">Name</th>
            <th align="left">Role</th>
            <th align="left">Created</th>
          </tr>
        </thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{u.email ?? "-"}</td>
              <td>{u.name ?? "-"}</td>
              <td>{u.role}</td>
              <td className="small muted">{new Date(u.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
