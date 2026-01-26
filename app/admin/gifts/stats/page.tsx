import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GiftsStats() {
  const rows = await prisma.starTransaction.groupBy({
    by: ["giftId"],
    where: { type: "GIFT", giftId: { not: null } },
    _sum: { stars: true, quantity: true },
    _count: { _all: true },
    orderBy: { _sum: { stars: "desc" } },
    take: 50,
  });

  const giftIds = rows.map((r) => r.giftId!).filter(Boolean);
  const gifts = await prisma.gift.findMany({
    where: { id: { in: giftIds } },
    select: { id: true, name: true, icon: true, starsCost: true, active: true },
  });
  const map = new Map(gifts.map((g) => [g.id, g]));

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700 }}>Gift stats</div>
          <div className="small muted">Top gifts theo tổng ⭐ spend (type=GIFT).</div>
        </div>
        <a className="small" href="/admin/gifts">
          Back
        </a>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left">Gift</th>
            <th align="right">Stars (sum)</th>
            <th align="right">Qty (sum)</th>
            <th align="right">Tx</th>
            <th align="left">Active</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const g = r.giftId ? map.get(r.giftId) : null;
            return (
              <tr key={r.giftId ?? "null"} style={{ borderTop: "1px solid #eee" }}>
                <td>
                  {g ? (
                    <span>
                      <span style={{ fontSize: 18, marginRight: 6 }}>{g.icon ?? "🎁"}</span>
                      <b>{g.name}</b> <span className="small muted">(cost {g.starsCost})</span>
                    </span>
                  ) : (
                    <span className="small muted">Unknown gift</span>
                  )}
                </td>
                <td align="right">
                  <b>{r._sum.stars ?? 0}</b>
                </td>
                <td align="right">{r._sum.quantity ?? 0}</td>
                <td align="right">{r._count._all}</td>
                <td>{g?.active ? "YES" : "NO"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
