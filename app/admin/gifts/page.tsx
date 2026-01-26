import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminGifts() {
  const gifts = await prisma.gift.findMany({ orderBy: [{ sort: "asc" }, { starsCost: "asc" }, { createdAt: "asc" }] });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card" style={{ maxWidth: 900 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Gifts</div>
          <a className="small" href="/admin/gifts/stats">View stats</a>
        </div>
        <p className="small muted">Quản lý danh sách quà tặng (cost = stars).</p>

        <form action="/api/admin/gifts" method="post" className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input type="hidden" name="op" value="create" />
          <input name="name" placeholder="Name (unique)" style={{ minWidth: 180 }} required />
          <input name="icon" placeholder="Icon (emoji)" style={{ width: 120 }} />
          <input name="starsCost" type="number" min={1} max={9999} defaultValue={1} style={{ width: 120 }} />
          <input name="sort" type="number" min={0} max={9999} defaultValue={0} style={{ width: 120 }} />
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button type="submit">Add</button>
        </form>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>List</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Icon</th>
              <th align="left">Name</th>
              <th align="left">Stars cost</th>
              <th align="left">Sort</th>
              <th align="left">Active</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {gifts.map((g) => (
              <tr key={g.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ fontSize: 20 }}>{g.icon ?? "🎁"}</td>
                <td>{g.name}</td>
                <td>{g.starsCost}</td>
                <td>{g.sort}</td>
                <td>{g.active ? "YES" : "NO"}</td>
                <td>
                  <details>
                    <summary className="small">Edit</summary>

                    <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                      <form action="/api/admin/gifts" method="post" style={{ display: "grid", gap: 6 }}>
                        <input type="hidden" name="op" value="update" />
                        <input type="hidden" name="id" value={g.id} />
                        <label className="small">Name</label>
                        <input name="name" defaultValue={g.name} required />
                        <label className="small">Icon</label>
                        <input name="icon" defaultValue={g.icon ?? ""} />
                        <label className="small">Stars cost</label>
                        <input name="starsCost" type="number" min={1} max={9999} defaultValue={g.starsCost} />
                        <label className="small">Sort</label>
                        <input name="sort" type="number" min={0} max={9999} defaultValue={g.sort} />
                        <label className="row small" style={{ gap: 6 }}>
                          <input type="checkbox" name="active" defaultChecked={g.active} /> Active
                        </label>
                        <button type="submit">Save</button>
                      </form>

                      <form action="/api/admin/gifts" method="post">
                        <input type="hidden" name="op" value="delete" />
                        <input type="hidden" name="id" value={g.id} />
                        <button type="submit">Delete</button>
                      </form>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
