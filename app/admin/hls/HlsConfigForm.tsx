"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type HlsCfg = {
  segmentSeconds: number;
  packaging: string;
  ladderJson: string;
};

const DEFAULTS: Record<number, { height: number; videoKbps: number; audioKbps: number }> = {
  1080: { height: 1080, videoKbps: 5000, audioKbps: 128 },
  720: { height: 720, videoKbps: 2800, audioKbps: 128 },
  480: { height: 480, videoKbps: 1400, audioKbps: 96 },
  360: { height: 360, videoKbps: 900, audioKbps: 64 },
};

function safeParseLadder(jsonStr: string): number[] {
  try {
    const arr = JSON.parse(jsonStr || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.map((x: any) => Number(x?.height)).filter((n) => [1080, 720, 480, 360].includes(n));
  } catch {
    return [];
  }
}

export default function HlsConfigForm({ cfg }: { cfg: HlsCfg }) {
  const existing = safeParseLadder(cfg.ladderJson);
  const [seg, setSeg] = useState<number>(cfg.segmentSeconds || 6);
  const [packaging, setPackaging] = useState<string>(cfg.packaging || "SINGLE_FILE");
  const [res, setRes] = useState<Record<number, boolean>>({
    360: existing.includes(360) || false,
    480: existing.includes(480) || true,
    720: existing.includes(720) || true,
    1080: existing.includes(1080) || true,
  });
  const [advanced, setAdvanced] = useState(false);
  const [ladderJson, setLadderJson] = useState(cfg.ladderJson || "[]");

  const computedLadder = useMemo(() => {
    const selected = [1080, 720, 480, 360].filter((h) => res[h]);
    const ladder = selected.map((h) => DEFAULTS[h]).sort((a, b) => b.height - a.height);
    return JSON.stringify(ladder, null, 2);
  }, [res]);

  return (
    <form action="/api/admin/hls-config" method="post" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>HLS Config</CardTitle>
          <CardDescription>
            Điều khiển segmentSeconds, packaging và ladder (checkbox → tự generate JSON).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="segmentSeconds">segmentSeconds</Label>
            <Input
              id="segmentSeconds"
              name="segmentSeconds"
              type="number"
              value={seg}
              onChange={(e) => setSeg(Number(e.target.value))}
              min={2}
              max={15}
            />
            <div className="text-xs text-zinc-500">
              Gợi ý: 6s (phổ biến), 2–4s (mượt seek), 8–12s (ít request hơn).
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="packaging">packaging</Label>
            <select
              id="packaging"
              name="packaging"
              value={packaging}
              onChange={(e) => setPackaging(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            >
              <option value="SINGLE_FILE">TS segments (.ts)</option>
              <option value="FMP4">fMP4 (init.mp4 + .m4s)</option>
              <option value="HYBRID_TS_ABR_FMP4_SOURCE">
                TS segments (.ts) 1080/720/480 + fMP4 (init.mp4 + .m4s) file gốc
              </option>
            </select>
            <div className="text-xs text-zinc-500">
              TS: tương thích rộng. fMP4: switch quality mượt hơn (ABR). Hybrid: phát ABR TS (1080/720/480)
              + thêm một playlist fMP4 "source" (giữ nguyên độ phân giải gốc).
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-semibold">Chọn độ phân giải</div>
            <div className="grid grid-cols-2 gap-2">
              {[360, 480, 720, 1080].map((h) => (
                <label
                  key={h}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={res[h]}
                    onChange={(e) => setRes((x) => ({ ...x, [h]: e.target.checked }))}
                  />
                  <span className="text-sm font-medium">{h}p</span>
                  <span className="ml-auto text-xs text-zinc-500">{DEFAULTS[h].videoKbps} kbps</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-zinc-500">
              Ladder sẽ tự generate theo checkbox. Bạn có thể bật Advanced để chỉnh tay JSON.
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={advanced}
              onChange={(e) => setAdvanced(e.target.checked)}
            />
            Advanced (edit ladderJson)
          </label>

          {/* Hidden ladderJson to submit */}
          <input type="hidden" name="ladderJson" value={advanced ? ladderJson : computedLadder} />

          {advanced ? (
            <div className="space-y-2">
              <Label htmlFor="ladderJson">ladderJson</Label>
              <Textarea
                id="ladderJson"
                rows={14}
                value={ladderJson}
                onChange={(e) => setLadderJson(e.target.value)}
                placeholder='[{"height":720,"videoKbps":2500,"audioKbps":128}]'
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Computed ladderJson</Label>
              <pre className="small max-h-[360px] overflow-auto rounded-xl bg-zinc-50 p-3">
                {computedLadder}
              </pre>
            </div>
          )}

          <div className="row justify-end">
            <Button type="submit">Save</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
