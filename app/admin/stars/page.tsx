import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminStars() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, email: true, name: true, role: true, starBalance: true, createdAt: true },
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card" style={{ maxWidth: 900 }}>
        <div style={{ fontWeight: 700 }}>Stars balance</div>
        <p className="small muted">
          Quản lý điểm sao của user. Delta (+) để grant, (-) để deduct. Tất cả thay đổi được log vào StarTransaction.
        </p>
        <a className="small" href="/admin/stars/transactions">Xem lịch sử giao dịch sao</a>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Users (200 latest)</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Email</th>
              <th align="left">Name</th>
              <th align="left">Role</th>
              <th align="left">Stars</th>
              <th align="left">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid #eee" }}>
                <td>{u.email ?? "-"}</td>
                <td>{u.name ?? "-"}</td>
                <td>{u.role}</td>
                <td><b>{u.starBalance}</b></td>
                <td>
                  <form action="/api/admin/stars-adjust" method="post" className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input name="delta" type="number" placeholder="+100 / -50" style={{ width: 140 }} required />
                    <input name="note" placeholder="Note" style={{ width: 220 }} />
                    <button type="submit">Apply</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
