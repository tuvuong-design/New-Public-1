import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminApiSources() {
  const list = await prisma.apiSource.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 980 }}>
      <div className="card">
        <div style={{ fontWeight: 700 }}>Create new source</div>
        <form action="/api/admin/api-sources" method="post" style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <input type="hidden" name="mode" value="create" />
          <input name="name" placeholder="Name" />
          <input name="prefix" placeholder="Prefix (unique) e.g. yt" />
          <input name="baseUrl" placeholder="Base URL e.g. https://example.com/api" />
          <input name="apiKey" placeholder="API key (optional)" />
          <label><input type="checkbox" name="enabled" defaultChecked /> Enabled</label>
          <textarea name="mappingJson" rows={10} placeholder='{"id":"id","title":"title","thumb":"thumb","hls":"hlsUrl","durationSec":"duration"}' />
          <button type="submit">Create</button>
        </form>
      </div>

      {list.map((s) => (
        <div key={s.id} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800 }}>{s.name} <span className="small muted">({s.prefix})</span></div>
              <div className="small muted">{s.baseUrl}</div>
            </div>
            <form action="/api/admin/api-sources/sync" method="post">
              <input type="hidden" name="id" value={s.id} />
              <button type="submit">Sync now</button>
            </form>
          </div>
          <form action="/api/admin/api-sources" method="post" style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <input type="hidden" name="mode" value="update" />
            <input type="hidden" name="id" value={s.id} />
            <input name="name" defaultValue={s.name} />
            <input name="prefix" defaultValue={s.prefix} />
            <input name="baseUrl" defaultValue={s.baseUrl} />
            <input name="apiKey" defaultValue={s.apiKey ?? ""} />
            <label><input type="checkbox" name="enabled" defaultChecked={s.enabled} /> Enabled</label>
            <textarea name="mappingJson" rows={10} defaultValue={s.mappingJson} />
            <button type="submit">Save</button>
          </form>
        </div>
      ))}
    </div>
  );
}
