import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dayStartUtc } from "@/lib/metrics";
import VideoAnalyticsCharts, { DailyRow } from "@/components/analytics/VideoAnalyticsCharts";
import CtrChart, { CtrDailyRow } from "@/components/analytics/CtrChart";

export const dynamic = "force-dynamic";

function fmtNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pct(n: number) {
  return `${Math.round(n * 10) / 10}%`;
}

export default async function StudioAnalyticsPage({ searchParams }: { searchParams: { days?: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const days = clamp(Number(searchParams.days ?? "7"), 1, 90);
  const start = dayStartUtc(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

  const videos = await prisma.video.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true, viewCount: true },
  });

  const videoIds = videos.map((v) => v.id);

  const metrics = videoIds.length
    ? await prisma.videoMetricDaily.findMany({
        where: { videoId: { in: videoIds }, day: { gte: start } },
        orderBy: { day: "asc" },
        select: { videoId: true, day: true, views: true, uniqueViews: true, watchSeconds: true, completes: true, impressions: true, clicks: true },
      })
    : [];

  // Per-video totals
  const byVideo = new Map<string, { views: number; uniqueViews: number; watchSeconds: number; completes: number; impressions: number; clicks: number }>();
  for (const m of metrics) {
    const cur = byVideo.get(m.videoId) ?? { views: 0, uniqueViews: 0, watchSeconds: 0, completes: 0, impressions: 0, clicks: 0 };
    cur.views += m.views;
    cur.uniqueViews += (m as any).uniqueViews ?? 0;
    cur.watchSeconds += (m as any).watchSeconds ?? 0;
    cur.completes += (m as any).completes ?? 0;
    cur.impressions += (m as any).impressions ?? 0;
    cur.clicks += (m as any).clicks ?? 0;
    byVideo.set(m.videoId, cur);
  }

  // Daily time series (aggregate across creator videos)
  const byDay = new Map<string, { views: number; uniqueViews: number; watchSeconds: number; completes: number; impressions: number; clicks: number }>();
  for (const m of metrics) {
    const day = m.day.toISOString().slice(0, 10);
    const cur = byDay.get(day) ?? { views: 0, uniqueViews: 0, watchSeconds: 0, completes: 0, impressions: 0, clicks: 0 };
    cur.views += m.views;
    cur.uniqueViews += (m as any).uniqueViews ?? 0;
    cur.watchSeconds += (m as any).watchSeconds ?? 0;
    cur.completes += (m as any).completes ?? 0;
    cur.impressions += (m as any).impressions ?? 0;
    cur.clicks += (m as any).clicks ?? 0;
    byDay.set(day, cur);
  }

  const daily: DailyRow[] = Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, v]) => ({ day, views: v.views, uniqueViews: v.uniqueViews, watchSeconds: v.watchSeconds, completes: v.completes }));

  const ctrDaily: CtrDailyRow[] = Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, v]) => ({ day, impressions: v.impressions, clicks: v.clicks }));

  const totals = Array.from(byVideo.values()).reduce(
    (acc, v) => {
      acc.views += v.views;
      acc.uniqueViews += v.uniqueViews;
      acc.watchSeconds += v.watchSeconds;
      acc.completes += v.completes;
      acc.impressions += v.impressions;
      acc.clicks += v.clicks;
      return acc;
    },
    { views: 0, uniqueViews: 0, watchSeconds: 0, completes: 0, impressions: 0, clicks: 0 },
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  // Traffic sources (aggregate)
  const traffic = videoIds.length
    ? await prisma.videoTrafficSourceDaily.findMany({
        where: { videoId: { in: videoIds }, day: { gte: start } },
        select: { source: true, impressions: true, clicks: true },
      })
    : [];

  const bySource = new Map<string, { impressions: number; clicks: number }>();
  for (const t of traffic) {
    const k = String(t.source);
    const cur = bySource.get(k) ?? { impressions: 0, clicks: 0 };
    cur.impressions += t.impressions;
    cur.clicks += t.clicks;
    bySource.set(k, cur);
  }

  const sources = Array.from(bySource.entries())
    .map(([source, v]) => ({ source, impressions: v.impressions, clicks: v.clicks, ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0 }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm text-neutral-500">Studio / Analytics</div>
          <h2 className="text-2xl font-extrabold">Tổng quan</h2>
          <div className="small muted mt-1">Unique views / Watch time / Retention (MVP) • CTR (thumbnail impressions/clicks)</div>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-muted" href="/studio">Studio home</Link>
          <Link className="btn btn-muted" href={`/studio/analytics?days=7`}>7d</Link>
          <Link className="btn btn-muted" href={`/studio/analytics?days=28`}>28d</Link>
          <Link className="btn btn-muted" href={`/studio/analytics?days=90`}>90d</Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="card">
          <div className="text-sm text-neutral-500">Views</div>
          <div className="text-2xl font-extrabold">{fmtNumber(totals.views)}</div>
          <div className="small muted mt-1">Unique: {fmtNumber(totals.uniqueViews)} • Completes: {fmtNumber(totals.completes)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-neutral-500">Watch time</div>
          <div className="text-2xl font-extrabold">{fmtNumber(Math.round(totals.watchSeconds / 360) / 10)}h</div>
          <div className="small muted mt-1">Last {days} days (UTC day buckets)</div>
        </div>
        <div className="card">
          <div className="text-sm text-neutral-500">CTR</div>
          <div className="text-2xl font-extrabold">{pct(ctr)}</div>
          <div className="small muted mt-1">Impressions: {fmtNumber(totals.impressions)} • Clicks: {fmtNumber(totals.clicks)}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <VideoAnalyticsCharts daily={daily} hourly={[]} retention={[]} />
        <CtrChart rows={ctrDaily} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="text-lg font-extrabold">Traffic sources (Top)</div>
          <div className="small muted mt-1">Best-effort (client-side impressions/clicks). Use as directional metric.</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2">Source</th>
                  <th className="py-2">Impressions</th>
                  <th className="py-2">Clicks</th>
                  <th className="py-2">CTR</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} className="border-t">
                    <td className="py-2 font-semibold">{s.source}</td>
                    <td className="py-2">{fmtNumber(s.impressions)}</td>
                    <td className="py-2">{fmtNumber(s.clicks)}</td>
                    <td className="py-2">{pct(s.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <div className="text-lg font-extrabold">Videos (Last {days} days)</div>
          <div className="mt-3">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2">Video</th>
                  <th className="py-2">Views</th>
                  <th className="py-2">Unique</th>
                  <th className="py-2">Watch hours</th>
                  <th className="py-2">Completes</th>
                  <th className="py-2">Impr.</th>
                  <th className="py-2">Clicks</th>
                  <th className="py-2">CTR</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => {
                  const m = byVideo.get(v.id) ?? { views: 0, uniqueViews: 0, watchSeconds: 0, completes: 0, impressions: 0, clicks: 0 };
                  const vCtr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
                  return (
                    <tr key={v.id} className="border-t">
                      <td className="py-2 pr-3">
                        <div className="font-semibold line-clamp-1">{v.title}</div>
                        <div className="text-xs text-neutral-500">All-time: {fmtNumber(v.viewCount)} views</div>
                      </td>
                      <td className="py-2">{fmtNumber(m.views)}</td>
                      <td className="py-2">{fmtNumber(m.uniqueViews)}</td>
                      <td className="py-2">{fmtNumber(Math.round(m.watchSeconds / 360) / 10)}</td>
                      <td className="py-2">{fmtNumber(m.completes)}</td>
                      <td className="py-2">{fmtNumber(m.impressions)}</td>
                      <td className="py-2">{fmtNumber(m.clicks)}</td>
                      <td className="py-2">{pct(vCtr)}</td>
                      <td className="py-2">
                        <Link className="btn btn-muted" href={`/studio/videos/${v.id}/analytics`}>Chi tiết</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {videos.length === 0 ? (
            <div className="card mt-4">
              <div className="text-lg font-extrabold">Chưa có video</div>
              <div className="small muted mt-1">Upload video để xem thống kê.</div>
              <div className="mt-3">
                <Link className="btn" href="/upload">Upload</Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
