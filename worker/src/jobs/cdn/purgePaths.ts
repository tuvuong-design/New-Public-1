import { env } from "../../env";

async function cloudflarePurge(urls: string[]) {
  if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN) return { ok: false, skipped: true };
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    },
    body: JSON.stringify({ files: urls.slice(0, 30) }),
  }).catch(() => null);
  if (!res) return { ok: false, error: "fetch_failed" };
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

export async function purgePathsJob(data: { paths: string[]; reason?: string }) {
  const paths = Array.isArray(data.paths) ? data.paths : [];
  const urls = paths.map((p) => (p.startsWith("http") ? p : `${env.SITE_URL}${p.startsWith("/") ? "" : "/"}${p}`));
  return cloudflarePurge(urls);
}
