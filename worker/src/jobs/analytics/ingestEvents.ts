import { prisma } from "../../prisma";
import { connection } from "../../queues";
import { dayIsoUtc, dayStartUtc, hourStartUtc } from "../../lib/analyticsTime";

type AnalyticsEvent = {
  type: "PRESENCE" | "EXPOSURE" | "VIEW_START" | "PROGRESS" | "COMPLETE" | "CARD_IMPRESSION" | "CARD_CLICK";
  videoId: string;
  ts?: number;
  positionSec?: number;
  durationSec?: number;
  deltaSec?: number;
  watchPctBp?: number;
  experimentId?: string;
  variantId?: string;
  source?: string;
  placement?: string;
};

const RET_THRESHOLDS: Array<{ bp: number; enum: any }> = [
  { bp: 2500, enum: "P25" },
  { bp: 5000, enum: "P50" },
  { bp: 7500, enum: "P75" },
  { bp: 9000, enum: "P90" },
  { bp: 9500, enum: "P95" },
];

function keyRealtime(videoId: string) {
  return `videoshare:realtime:viewers:v1:${videoId}`;
}
function keyUv(videoId: string, dayIso: string) {
  return `videoshare:analytics:uv:v1:${videoId}:${dayIso}`;
}
function keyRetMax(videoId: string, dayIso: string) {
  return `videoshare:analytics:retmax:v1:${videoId}:${dayIso}`;
}

function normSource(src?: string): any {
  const v = String(src || 'UNKNOWN').toUpperCase();
  const allowed = new Set(['HOME','FEED','SEARCH','EXPLORE','TRENDING','PLAYLIST','CHANNEL','EXTERNAL','UNKNOWN']);
  return allowed.has(v) ? v : 'UNKNOWN';
}

export async function analyticsIngestEventsJob(input: {
  vsid: string;
  userId: string | null;
  country: string;
  receivedAtMs: number;
  events: AnalyticsEvent[];
}) {
  const now = new Date();
  const day = dayStartUtc(now);
  const hour = hourStartUtc(now);
  const dayIso = dayIsoUtc(now);
  const country = (input.country || "ZZ").toUpperCase().slice(0, 2);

  // Aggregate increments for fewer DB writes.
  const dailyByVideo = new Map<string, { uniqueViews: number; watchSeconds: number; completes: number; impressions: number; clicks: number }>();
  const hourlyByKey = new Map<string, { videoId: string; hour: Date; uniqueViews: number; watchSeconds: number; completes: number }>();
  const countryByKey = new Map<string, { videoId: string; day: Date; country: string; uniqueViews: number; watchSeconds: number }>();
  const retentionIncs = new Map<string, { videoId: string; day: Date; threshold: any; inc: number }>();

  // CTR impressions/clicks by source
  const trafficByKey = new Map<string, { videoId: string; day: Date; source: any; impressions: number; clicks: number }>();

  const variantIncs = new Map<string, { exposures: number; views: number; watchSeconds: number; completes: number }>();

  // Redis operations
  const pipe = connection.pipeline();

  // Presence: always update for realtime
  for (const ev of input.events) {
    if (!ev?.videoId) continue;
    if (ev.type === "PRESENCE") {
      const rk = keyRealtime(ev.videoId);
      pipe.zadd(rk, input.receivedAtMs, input.vsid);
      pipe.pexpire(rk, 120_000);
    }
  }

  // VIEW_START: unique view (per day)
  for (const ev of input.events) {
    if (!ev?.videoId) continue;

    if (ev.type === "EXPOSURE" && ev.variantId) {
      const cur = variantIncs.get(ev.variantId) ?? { exposures: 0, views: 0, watchSeconds: 0, completes: 0 };
      cur.exposures += 1;
      variantIncs.set(ev.variantId, cur);
    }

    if (ev.type === "VIEW_START") {
      const uvk = keyUv(ev.videoId, dayIso);
      pipe.sadd(uvk, input.vsid);
      pipe.pexpire(uvk, 2 * 24 * 60 * 60 * 1000);

      if (ev.variantId) {
        const cur = variantIncs.get(ev.variantId) ?? { exposures: 0, views: 0, watchSeconds: 0, completes: 0 };
        cur.views += 1;
        variantIncs.set(ev.variantId, cur);
      }
    }
  }

  // CARD_IMPRESSION / CARD_CLICK: CTR (thumbnail/card)
  for (const ev of input.events) {
    if (!ev?.videoId) continue;
    if (ev.type === 'CARD_IMPRESSION') {
      const src = normSource(ev.source);
      const k = `${ev.videoId}:${dayIso}:${src}`;
      const cur = trafficByKey.get(k) ?? { videoId: ev.videoId, day, source: src, impressions: 0, clicks: 0 };
      cur.impressions += 1;
      trafficByKey.set(k, cur);
      const d = dailyByVideo.get(ev.videoId) ?? { uniqueViews: 0, watchSeconds: 0, completes: 0, impressions: 0, clicks: 0 };
      d.impressions += 1;
      dailyByVideo.set(ev.videoId, d);
    }
    if (ev.type === 'CARD_CLICK') {
      const src = normSource(ev.source);
      const k = `${ev.videoId}:${dayIso}:${src}`;
      const cur = trafficByKey.get(k) ?? { videoId: ev.videoId, day, source: src, impressions: 0, clicks: 0 };
      cur.clicks += 1;
      trafficByKey.set(k, cur);
      const d = dailyByVideo.get(ev.videoId) ?? { uniqueViews: 0, watchSeconds: 0, completes: 0, impressions: 0, clicks: 0 };
      d.clicks += 1;
      dailyByVideo.set(ev.videoId, d);
    }
  }

  // PROGRESS / COMPLETE: watch time + retention
  for (const ev of input.events) {
    if (!ev?.videoId) continue;

    if (ev.type === "PROGRESS") {
      const delta = Math.max(0, Math.floor(ev.deltaSec ?? 0));
      if (delta > 0) {
        const d = dailyByVideo.get(ev.videoId) ?? { uniqueViews: 0, watchSeconds: 0, completes: 0, impressions: 0, clicks: 0 };
        d.watchSeconds += delta;
        dailyByVideo.set(ev.videoId, d);

        const hk = `${ev.videoId}:${hour.toISOString()}`;
        const h = hourlyByKey.get(hk) ?? { videoId: ev.videoId, hour, uniqueViews: 0, watchSeconds: 0, completes: 0 };
        h.watchSeconds += delta;
        hourlyByKey.set(hk, h);

        const ck = `${ev.videoId}:${dayIso}:${country}`;
        const c = countryByKey.get(ck) ?? { videoId: ev.videoId, day, country, uniqueViews: 0, watchSeconds: 0 };
        c.watchSeconds += delta;
        countryByKey.set(ck, c);

        if (ev.variantId) {
          const cur = variantIncs.get(ev.variantId) ?? { exposures: 0, views: 0, watchSeconds: 0, completes: 0 };
          cur.watchSeconds += delta;
          variantIncs.set(ev.variantId, cur);
        }
      }

      if (typeof ev.watchPctBp === "number") {
        const rk = keyRetMax(ev.videoId, dayIso);
        pipe.hget(rk, input.vsid);
      }
    }

    if (ev.type === "COMPLETE") {
      const d = dailyByVideo.get(ev.videoId) ?? { uniqueViews: 0, watchSeconds: 0, completes: 0, impressions: 0, clicks: 0 };
      d.completes += 1;
      dailyByVideo.set(ev.videoId, d);

      const hk = `${ev.videoId}:${hour.toISOString()}`;
      const h = hourlyByKey.get(hk) ?? { videoId: ev.videoId, hour, uniqueViews: 0, watchSeconds: 0, completes: 0 };
      h.completes += 1;
      hourlyByKey.set(hk, h);

      if (ev.variantId) {
        const cur = variantIncs.get(ev.variantId) ?? { exposures: 0, views: 0, watchSeconds: 0, completes: 0 };
        cur.completes += 1;
        variantIncs.set(ev.variantId, cur);
      }

      // retention: treat COMPLETE as >=95%
      const rk = keyRetMax(ev.videoId, dayIso);
      pipe.hget(rk, input.vsid);
    }
  }

  // Execute redis pipeline for sadd results and hget results.
  const redisRes = await pipe.exec();
  // Parse results: We'll walk again to consume results in the same order we pushed.
  let idx = 0;

  // First loop: PRESENCE zadd+pexpire (2 ops each)
  for (const ev of input.events) {
    if (ev.type === "PRESENCE" && ev.videoId) {
      idx += 2;
    }
  }

  // Second loop: VIEW_START sadd+pexpire (2 ops each)
  const uvNewByVideo = new Map<string, number>();
  for (const ev of input.events) {
    if (ev.type === "VIEW_START" && ev.videoId) {
      const saddRes = redisRes?.[idx]?.[1] as any;
      const added = Number(saddRes ?? 0);
      idx += 1;
      idx += 1; // pexpire
      if (added > 0) {
        uvNewByVideo.set(ev.videoId, (uvNewByVideo.get(ev.videoId) ?? 0) + 1);
      }
    }
  }

  // Third loop: PROGRESS hget (1 op each when watchPctBp is number)
  // Fourth loop: COMPLETE hget (1 op each)
  // We'll compute retention updates now with a second redis pipeline to set max and expire.
  const retPipe = connection.pipeline();
  const retNeedUpdate: Array<{ videoId: string; newBp: number; oldBp: number }> = [];

  for (const ev of input.events) {
    if (ev.type === "PROGRESS" && ev.videoId && typeof ev.watchPctBp === "number") {
      const oldRaw = (redisRes?.[idx]?.[1] as string | null) ?? null;
      idx += 1;
      const old = oldRaw ? Number(oldRaw) : 0;
      const cur = Math.max(0, Math.min(10000, Math.floor(ev.watchPctBp)));
      if (cur > old) {
        retNeedUpdate.push({ videoId: ev.videoId, newBp: cur, oldBp: old });
      }
    }
    if (ev.type === "COMPLETE" && ev.videoId) {
      const oldRaw = (redisRes?.[idx]?.[1] as string | null) ?? null;
      idx += 1;
      const old = oldRaw ? Number(oldRaw) : 0;
      const cur = 9500;
      if (cur > old) {
        retNeedUpdate.push({ videoId: ev.videoId, newBp: cur, oldBp: old });
      }
    }
  }

  for (const item of retNeedUpdate) {
    const rk = keyRetMax(item.videoId, dayIso);
    retPipe.hset(rk, input.vsid, item.newBp);
    retPipe.pexpire(rk, 2 * 24 * 60 * 60 * 1000);

    for (const t of RET_THRESHOLDS) {
      if (item.oldBp < t.bp && item.newBp >= t.bp) {
        const k = `${item.videoId}:${dayIso}:${t.enum}`;
        retentionIncs.set(k, { videoId: item.videoId, day, threshold: t.enum, inc: (retentionIncs.get(k)?.inc ?? 0) + 1 });
      }
    }
  }

  if (retNeedUpdate.length) {
    await retPipe.exec();
  }

  // Apply unique view increments to daily/hourly/country.
  for (const [videoId, added] of uvNewByVideo.entries()) {
    const d = dailyByVideo.get(videoId) ?? { uniqueViews: 0, watchSeconds: 0, completes: 0, impressions: 0, clicks: 0 };
    d.uniqueViews += added;
    dailyByVideo.set(videoId, d);

    const hk = `${videoId}:${hour.toISOString()}`;
    const h = hourlyByKey.get(hk) ?? { videoId, hour, uniqueViews: 0, watchSeconds: 0, completes: 0 };
    h.uniqueViews += added;
    hourlyByKey.set(hk, h);

    const ck = `${videoId}:${dayIso}:${country}`;
    const c = countryByKey.get(ck) ?? { videoId, day, country, uniqueViews: 0, watchSeconds: 0 };
    c.uniqueViews += added;
    countryByKey.set(ck, c);
  }

  // DB writes
  await prisma.$transaction(async (tx) => {
    for (const [videoId, inc] of dailyByVideo.entries()) {
      if (inc.uniqueViews <= 0 && inc.watchSeconds <= 0 && inc.completes <= 0 && inc.impressions <= 0 && inc.clicks <= 0) continue;
      await tx.videoMetricDaily.upsert({
        where: { videoId_day: { videoId, day } },
        update: {
          uniqueViews: { increment: inc.uniqueViews },
          watchSeconds: { increment: inc.watchSeconds },
          completes: { increment: inc.completes },
          impressions: { increment: inc.impressions },
          clicks: { increment: inc.clicks },
        },
        create: { videoId, day, uniqueViews: inc.uniqueViews, watchSeconds: inc.watchSeconds, completes: inc.completes, impressions: inc.impressions, clicks: inc.clicks },
      });
    }

    for (const item of hourlyByKey.values()) {
      if (item.uniqueViews <= 0 && item.watchSeconds <= 0 && item.completes <= 0) continue;
      await tx.videoMetricHourly.upsert({
        where: { videoId_hour: { videoId: item.videoId, hour: item.hour } },
        update: {
          uniqueViews: { increment: item.uniqueViews },
          watchSeconds: { increment: item.watchSeconds },
          completes: { increment: item.completes },
        },
        create: { videoId: item.videoId, hour: item.hour, uniqueViews: item.uniqueViews, watchSeconds: item.watchSeconds, completes: item.completes },
      });
    }

    for (const item of countryByKey.values()) {
      if (item.uniqueViews <= 0 && item.watchSeconds <= 0) continue;
      await tx.videoAudienceCountryDaily.upsert({
        where: { videoId_day_country: { videoId: item.videoId, day: item.day, country: item.country } },
        update: {
          uniqueViews: { increment: item.uniqueViews },
          watchSeconds: { increment: item.watchSeconds },
        },
        create: { videoId: item.videoId, day: item.day, country: item.country, uniqueViews: item.uniqueViews, watchSeconds: item.watchSeconds },
      });
    }

    for (const item of retentionIncs.values()) {
      await tx.videoRetentionDaily.upsert({
        where: { videoId_day_threshold: { videoId: item.videoId, day: item.day, threshold: item.threshold } },
        update: { sessions: { increment: item.inc } },
        create: { videoId: item.videoId, day: item.day, threshold: item.threshold, sessions: item.inc },
      });
    }

    // CTR by traffic source
    for (const item of trafficByKey.values()) {
      if (item.impressions <= 0 && item.clicks <= 0) continue;
      await tx.videoTrafficSourceDaily.upsert({
        where: { videoId_day_source: { videoId: item.videoId, day: item.day, source: item.source } },
        update: {
          impressions: { increment: item.impressions },
          clicks: { increment: item.clicks },
        },
        create: { videoId: item.videoId, day: item.day, source: item.source, impressions: item.impressions, clicks: item.clicks },
      });
    }

    // Traffic sources (CTR)
    for (const item of trafficByKey.values()) {
      if (item.impressions <= 0 && item.clicks <= 0) continue;
      await tx.videoTrafficSourceDaily.upsert({
        where: { videoId_day_source: { videoId: item.videoId, day: item.day, source: item.source } },
        update: { impressions: { increment: item.impressions }, clicks: { increment: item.clicks } },
        create: { videoId: item.videoId, day: item.day, source: item.source, impressions: item.impressions, clicks: item.clicks },
      });
    }

    // Variant aggregates
    for (const [variantId, v] of variantIncs.entries()) {
      if (v.exposures <= 0 && v.views <= 0 && v.watchSeconds <= 0 && v.completes <= 0) continue;
      try {
        await tx.videoExperimentVariant.update({
          where: { id: variantId },
          data: {
            exposures: { increment: v.exposures },
            views: { increment: v.views },
            watchSeconds: { increment: v.watchSeconds },
            completes: { increment: v.completes },
          },
        });
      } catch {
        // ignore unknown variant
      }
    }
  });
}
