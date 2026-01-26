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
} from "recharts";

export type CtrDailyRow = {
  day: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
};

export default function CtrChart({ rows }: { rows: CtrDailyRow[] }) {
  const data = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        ctrPct: r.impressions > 0 ? Math.round((r.clicks / r.impressions) * 1000) / 10 : 0,
      })),
    [rows],
  );

  return (
    <div className="card">
      <div className="text-lg font-extrabold">CTR (thumbnail/card)</div>
      <div className="small muted mt-1">Impressions, clicks, CTR%</div>
      <div className="mt-4 h-[280px]">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="impressions" dot={false} />
            <Line type="monotone" dataKey="clicks" dot={false} />
            <Line type="monotone" dataKey="ctrPct" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
