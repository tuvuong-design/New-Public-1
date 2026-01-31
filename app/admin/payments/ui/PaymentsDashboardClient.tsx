"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, BarChart, Bar } from "recharts";

type TokenTotalsRow = {
  asset: string;
  deposits: number;
  expectedSum: number;
  actualSum: number;
  successDeposits: number;
};

type StarsCredited = {
  totalStars: number;
  txCount: number;
  buckets: Array<{ t: string; starsSum: number; txCount: number }>;
  topUsers: Array<{ userId: string; email: string | null; starsSum: number; txCount: number }>;
};

type DashboardResponse = {
  buckets: Array<{ t: string; volume: number; amountSum: number } & Record<string, number>>;
  chains: string[];
  providerAccuracy: Array<{ provider: string; total: number; failed: number; failRate: number }>;
  breakdownAsset: Array<{ asset: string; total: number; failed: number; failRate: number }>;
  tokenTotals: TokenTotalsRow[];
  topFailReasons: Array<{ reason: string; count: number }>;
  topFailUsers: Array<{ userId: string; email: string | null; count: number }>;
  starsCredited: StarsCredited;
};

const CHAINS = ["ALL", "SOLANA", "ETHEREUM", "POLYGON", "BSC", "BASE", "TRON"] as const;

type TabKey = "deposits" | "stars" | "tokens";

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PaymentsDashboardClient({
  initial,
}: {
  initial: { from?: string; to?: string; chain?: string; asset?: string };
}) {
  const now = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return toLocalInputValue(d);
  }, [now]);

  const [from, setFrom] = useState(initial.from || defaultFrom);
  const [to, setTo] = useState(initial.to || toLocalInputValue(now));
  const [chain, setChain] = useState(initial.chain || "ALL");
  const [asset, setAsset] = useState(initial.asset || "");
  const [tab, setTab] = useState<TabKey>("deposits");

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", new Date(from).toISOString());
    if (to) p.set("to", new Date(to).toISOString());
    if (chain && chain !== "ALL") p.set("chain", chain);
    if (asset) p.set("asset", asset);
    return p.toString();
  }, [from, to, chain, asset]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/dashboard?${query}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "failed");
      setData(json as DashboardResponse);
    } catch (e: any) {
      setError(e?.message || "failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportHref = useMemo(() => `/api/admin/payments/export/deposits?${query}`, [query]);

  function TabButton({ k, label }: { k: TabKey; label: string }) {
    return (
      <Button
        size="sm"
        variant={tab === k ? "default" : "secondary"}
        onClick={() => setTab(k)}
        disabled={loading}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">From</div>
              <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">To</div>
              <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Chain</div>
              <Select value={chain} onValueChange={setChain}>
                <SelectTrigger>
                  <SelectValue placeholder="Chain" />
                </SelectTrigger>
                <SelectContent>
                  {CHAINS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Asset symbol</div>
              <Input
                placeholder="USDT / USDC / ETH ..."
                value={asset}
                onChange={(e) => setAsset(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Apply"}
            </Button>
            <a className="inline-flex" href={exportHref}>
              <Button variant="secondary" type="button">
                Export deposits CSV
              </Button>
            </a>
            <a className="inline-flex" href={`/admin/payments/deposits?${query}`}>
              <Button variant="secondary" type="button">
                Open deposits list
              </Button>
            </a>
            <a className="inline-flex" href={`/admin/payments/unmatched?${query}`}>
              <Button variant="secondary" type="button">
                Unmatched inbox
              </Button>
            </a>
          </div>
          {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deposits analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <TabButton k="deposits" label="Deposits" />
            <TabButton k="stars" label="Stars credited" />
            <TabButton k="tokens" label="Token totals" />
          </div>
        </CardContent>
      </Card>

      {tab === "deposits" ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fail-rate by chain (15m buckets)</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.buckets || []}>
                    <XAxis dataKey="t" hide />
                    <YAxis tickFormatter={(v) => `${Math.round(v)}%`} />
                    <Tooltip />
                    <Legend />
                    {(data?.chains || []).map((c) => (
                      <Line key={c} type="monotone" dataKey={`${c}_failRate`} name={`${c}`} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Volume (count) per 15m</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.buckets || []}>
                    <XAxis dataKey="t" hide />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="volume" name="Deposits" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total amount (sum expected) per 15m</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.buckets || []}>
                    <XAxis dataKey="t" hide />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="amountSum" name="Amount" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Provider accuracy report</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Fail-rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.providerAccuracy || []).map((r) => (
                      <TableRow key={r.provider}>
                        <TableCell>{r.provider}</TableCell>
                        <TableCell className="text-right">{r.total}</TableCell>
                        <TableCell className="text-right">{r.failed}</TableCell>
                        <TableCell className="text-right">{(r.failRate * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top failing reasons (24h, filtered)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topFailReasons || []).map((r) => (
                      <TableRow key={r.reason}>
                        <TableCell className="max-w-[520px] truncate">{r.reason}</TableCell>
                        <TableCell className="text-right">{r.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top users causing failures (24h, filtered)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topFailUsers || []).map((r) => (
                      <TableRow key={r.userId}>
                        <TableCell className="max-w-[520px] truncate">{r.email || r.userId}</TableCell>
                        <TableCell className="text-right">{r.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Breakdown by asset (filtered)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Fail-rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.breakdownAsset || []).map((r) => (
                      <TableRow key={r.asset}>
                        <TableCell>{r.asset}</TableCell>
                        <TableCell className="text-right">{r.total}</TableCell>
                        <TableCell className="text-right">{r.failed}</TableCell>
                        <TableCell className="text-right">{(r.failRate * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Useful links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <a className="text-blue-600 underline" href={`/admin/payments/webhooks?${query}`}>
                  Webhook logs
                </a>
                <a className="block text-blue-600 underline" href={`/admin/payments/events?${query}`}>
                  Deposit events
                </a>
                <a className="block text-blue-600 underline" href={`/admin/payments/config`}>
                  Payments config
                </a>
                <a className="block text-blue-600 underline" href={`/admin/payments/bundles`}>
                  Bundles (Topup bonus)
                </a>
                <a className="block text-blue-600 underline" href={`/admin/payments/coupons`}>
                  Coupons
                </a>
                <a className="block text-blue-600 underline" href={`/admin/payments/fraud`}>
                  Fraud radar
                </a>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {tab === "stars" ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Stars credited summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total stars</span>
                    <span className="font-medium">{data?.starsCredited?.totalStars ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Topup tx count</span>
                    <span className="font-medium">{data?.starsCredited?.txCount ?? 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stars credited per 15m</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.starsCredited?.buckets || []}>
                    <XAxis dataKey="t" hide />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="starsSum" name="Stars" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top users by credited stars (filtered)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Stars</TableHead>
                    <TableHead className="text-right">Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.starsCredited?.topUsers || []).map((r) => (
                    <TableRow key={r.userId}>
                      <TableCell className="max-w-[520px] truncate">{r.email || r.userId}</TableCell>
                      <TableCell className="text-right">{r.starsSum}</TableCell>
                      <TableCell className="text-right">{r.txCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {tab === "tokens" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Token totals by symbol (filtered)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Deposits</TableHead>
                    <TableHead className="text-right">Expected sum</TableHead>
                    <TableHead className="text-right">Confirmed/Credited</TableHead>
                    <TableHead className="text-right">Actual sum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.tokenTotals || []).map((r) => (
                    <TableRow key={r.asset}>
                      <TableCell>{r.asset}</TableCell>
                      <TableCell className="text-right">{r.deposits}</TableCell>
                      <TableCell className="text-right">{r.expectedSum}</TableCell>
                      <TableCell className="text-right">{r.successDeposits}</TableCell>
                      <TableCell className="text-right">{r.actualSum}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token volume (top 20)</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(data?.tokenTotals || []).slice(0, 20)}>
                  <XAxis dataKey="asset" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="deposits" name="Deposits" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
