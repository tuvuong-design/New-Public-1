import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayStartUtc } from "@/lib/metrics";
import VideoAnalyticsCharts, { DailyRow, HourlyRow, RetentionRow } from "@/components/analytics/VideoAnalyticsCharts";
import ExperimentControls from "@/components/analytics/ExperimentControls";

export const dynamic = "force-dynamic";

function fmtNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}

export default async function StudioVideoAnalyticsPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const video = await prisma.video.findUnique({ where: { id: params.id }, select: { id: true, title: true, authorId: true, viewCount: true, likeCount: true, starCount: true, createdAt: true } });
  if (!video) notFound();
  if (video.authorId !== userId) redirect("/studio/analytics");

  const start30 = dayStartUtc(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const dailyRaw = await prisma.videoMetricDaily.findMany({
    where: { videoId: video.id, day: { gte: start30 } },
    orderBy: { day: "asc" },
    select: { day: true, views: true, uniqueViews: true, watchSeconds: true, completes: true },
  });

  const daily: DailyRow[] = dailyRaw.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    views: r.views,
    uniqueViews: (r as any).uniqueViews ?? 0,
    watchSeconds: (r as any).watchSeconds ?? 0,
    completes: (r as any).completes ?? 0,
  }));

  const start24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const hourlyRaw = await prisma.videoMetricHourly.findMany({
    where: { videoId: video.id, hour: { gte: start24h } },
    orderBy: { hour: "asc" },
    select: { hour: true, uniqueViews: true, watchSeconds: true, completes: true },
  });

  const hourly: HourlyRow[] = hourlyRaw.map((r) => ({
    hour: r.hour.toISOString(),
    uniqueViews: r.uniqueViews,
    watchSeconds: r.watchSeconds,
    completes: r.completes,
  }));

  const start7 = dayStartUtc(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const retRaw = await prisma.videoRetentionDaily.findMany({ where: { videoId: video.id, day: { gte: start7 } }, select: { threshold: true, sessions: true } });
  const retMap = new Map<string, number>();
  for (const r of retRaw) retMap.set(String(r.threshold), (retMap.get(String(r.threshold)) ?? 0) + r.sessions);
  const retention: RetentionRow[] = Array.from(retMap.entries()).map(([threshold, sessions]) => ({ threshold, sessions }));

  const countriesRaw = await prisma.videoAudienceCountryDaily.findMany({
    where: { videoId: video.id, day: { gte: start7 } },
    select: { country: true, uniqueViews: true, watchSeconds: true },
  });
  const cMap = new Map<string, { uniqueViews: number; watchSeconds: number }>();
  for (const r of countriesRaw) {
    const c = cMap.get(r.country) ?? { uniqueViews: 0, watchSeconds: 0 };
    c.uniqueViews += r.uniqueViews;
    c.watchSeconds += r.watchSeconds;
    cMap.set(r.country, c);
  }
  const countries = Array.from(cMap.entries())
    .map(([country, v]) => ({ country, ...v }))
    .sort((a, b) => b.uniqueViews - a.uniqueViews)
    .slice(0, 10);

  const experiment = await prisma.videoExperiment.findFirst({
    where: { videoId: video.id },
    orderBy: { createdAt: "desc" },
    include: { variants: { orderBy: { name: "asc" } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm text-neutral-500">Studio / Analytics</div>
          <h2 className="text-2xl font-extrabold">{video.title}</h2>
          <div className="small muted mt-1">All-time: {fmtNumber(video.viewCount)} views • {fmtNumber(video.likeCount)} likes • {fmtNumber(video.starCount)} stars</div>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-muted" href={`/v/${video.id}`}>Open video</Link>
          <Link className="btn btn-muted" href={`/studio/videos/${video.id}/seo`}>SEO</Link>
          <Link className="btn btn-muted" href={`/studio/videos/${video.id}/chapters`}>Chapters</Link>
          <Link className="btn btn-muted" href="/studio/analytics">Back</Link>
        </div>
      </div>

      <VideoAnalyticsCharts daily={daily} hourly={hourly} retention={retention} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="text-lg font-extrabold">Audience (Top countries, 7 days)</div>
          <div className="small muted mt-1">Country inferred from request headers (CF/Vercel). "ZZ" = unknown.</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2">Country</th>
                  <th className="py-2">Unique</th>
                  <th className="py-2">Watch hours</th>
                </tr>
              </thead>
              <tbody>
                {countries.map((c) => (
                  <tr key={c.country} className="border-t">
                    <td className="py-2 font-semibold">{c.country}</td>
                    <td className="py-2">{fmtNumber(c.uniqueViews)}</td>
                    <td className="py-2">{fmtNumber(Math.round(c.watchSeconds / 360) / 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="text-lg font-extrabold">A/B Variants (aggregate)</div>
          {experiment ? (
            <div className="mt-2 overflow-x-auto">
              <div className="small muted">Experiment status: {experiment.status}</div>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2">Variant</th>
                    <th className="py-2">Exposures</th>
                    <th className="py-2">Views</th>
                    <th className="py-2">Watch hours</th>
                    <th className="py-2">Completes</th>
                  </tr>
                </thead>
                <tbody>
                  {experiment.variants.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="py-2 font-semibold">{v.name}</td>
                      <td className="py-2">{fmtNumber(v.exposures)}</td>
                      <td className="py-2">{fmtNumber(v.views)}</td>
                      <td className="py-2">{fmtNumber(Math.round(v.watchSeconds / 360) / 10)}</td>
                      <td className="py-2">{fmtNumber(v.completes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="small muted mt-2">No experiment yet.</div>
          )}
        </div>
      </div>

      <ExperimentControls
        videoId={video.id}
        existingExperiment={experiment ? { id: experiment.id, status: experiment.status as any } : null}
      />
    </div>
  );
}
