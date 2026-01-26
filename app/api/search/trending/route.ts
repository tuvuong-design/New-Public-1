import { getTrendingQueries } from "@/lib/search/trending";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 20;
  const out = await getTrendingQueries({ limit: Number.isFinite(limit) ? limit : 20 });
  return Response.json({ ok: true, ...out });
}
