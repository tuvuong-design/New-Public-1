import { env, flags } from "./env";

type IndexNowBody = {
  host: string;
  key: string;
  keyLocation?: string;
  urlList: string[];
};

export async function pingIndexNow(urls: string[]) {
  if (!flags.indexNow) return { ok: true, skipped: true };

  if (!env.INDEXNOW_KEY) throw new Error("INDEXNOW_KEY missing");
  const host = new URL(env.SITE_URL).host;

  const body: IndexNowBody = {
    host,
    key: env.INDEXNOW_KEY,
    keyLocation: env.INDEXNOW_KEY_LOCATION || undefined,
    urlList: urls,
  };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
}
