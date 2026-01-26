import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAds() {
  const list = await prisma.adPlacement.findMany({ orderBy: { scope: "asc" } });

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
      {list.map((p) => (
        <div key={p.scope} className="card">
          <div style={{ fontWeight: 800 }}>{p.scope}</div>
          <form action="/api/admin/ad-placement" method="post" style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <input type="hidden" name="scope" value={p.scope} />
            <label><input type="checkbox" name="enabled" defaultChecked={p.enabled} /> Enabled</label>

            <div style={{ display: "grid", gap: 6 }}>
              <div className="small muted">Targeting</div>
              <label><input type="checkbox" name="showOnMobile" defaultChecked={(p as any).showOnMobile} /> Show on Mobile</label>
              <label><input type="checkbox" name="showOnTablet" defaultChecked={(p as any).showOnTablet} /> Show on Tablet</label>
              <label><input type="checkbox" name="showOnDesktop" defaultChecked={(p as any).showOnDesktop} /> Show on Desktop</label>
              <label><input type="checkbox" name="hideForBots" defaultChecked={(p as any).hideForBots} /> Hide for bots (SEO/Googlebot)</label>
              <div className="small muted">Default: mobile+tablet only, hidden for bots.</div>
            </div>
            <label>Every N (COMMENTS = interval; FEED = interval cho ads slot mix: HTML ads ↔ boosted video luân phiên)  // FEED mixing</label>
            <input type="number" name="everyN" defaultValue={p.everyN} />
            <label>HTML</label>
            <textarea name="html" rows={6} defaultValue={p.html} />
            <button type="submit">Save {p.scope}</button>
          </form>
        </div>
      ))}
    </div>
  );
}
