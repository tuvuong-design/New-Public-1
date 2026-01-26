"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

export type DailyRow = {
  day: string; // YYYY-MM-DD
  views: number;
  uniqueViews: number;
  watchSeconds: number;
  completes: number;
};

export type HourlyRow = {
  hour: string; // ISO
  uniqueViews: number;
  watchSeconds: number;
  completes: number;
};

export type RetentionRow = {
  threshold: string; // P25 etc
  sessions: number;
};

export default function VideoAnalyticsCharts({
  daily,
  hourly,
  retention,
}: {
  daily: DailyRow[];
  hourly: HourlyRow[];
  retention: RetentionRow[];
}) {
  const dailyData = useMemo(() =>
    daily.map((d) => ({
      ...d,
      watchHours: Math.round((d.watchSeconds / 360) ) / 10,
    })),
  [daily]);

  const hourlyData = useMemo(() =>
    hourly.map((h) => ({
      ...h,
      hourLabel: new Date(h.hour).toISOString().slice(11, 16),
      watchHours: Math.round((h.watchSeconds / 360)) / 10,
    })),
  [hourly]);

  const retentionData = useMemo(() => {
    const order = ["P25", "P50", "P75", "P90", "P95"];
    const m = new Map(retention.map((r) => [r.threshold, r.sessions]));
    return order.map((t) => ({ threshold: t, sessions: m.get(t) ?? 0 }));
  }, [retention]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="text-lg font-extrabold">Daily performance</div>
        <div className="small muted mt-1">Views, Unique views, Watch hours, Completes</div>
        <div className="mt-4 h-[280px]">
          <ResponsiveContainer>
            <LineChart data={dailyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="views" dot={false} />
              <Line type="monotone" dataKey="uniqueViews" dot={false} />
              <Line type="monotone" dataKey="watchHours" dot={false} />
              <Line type="monotone" dataKey="completes" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="text-lg font-extrabold">Hourly trend</div>
          <div className="small muted mt-1">Last 24 hours (UTC hours)</div>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer>
              <BarChart data={hourlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hourLabel" tick={{ fontSize: 12 }} interval={3} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="uniqueViews" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="text-lg font-extrabold">Retention (sessions reaching threshold)</div>
          <div className="small muted mt-1">Cumulative: count of sessions that reached each % watched</div>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer>
              <BarChart data={retentionData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="threshold" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="sessions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
