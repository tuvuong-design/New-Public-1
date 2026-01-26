import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { txExplorerUrl, addressExplorerUrl } from "@/lib/payments/explorer";

const PAGE_SIZE = 50;

function parseDate(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export default async function DepositsPage({
  searchParams,
}: {
  searchParams?: { q?: string; chain?: string; status?: string; asset?: string; from?: string; to?: string; page?: string };
}) {
  const q = (searchParams?.q || "").trim();
  const chain = (searchParams?.chain || "").trim();
  const status = (searchParams?.status || "").trim();
  const asset = (searchParams?.asset || "").trim().toUpperCase();
  const from = parseDate(searchParams?.from) || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = parseDate(searchParams?.to) || new Date();
  const page = Math.max(1, Number(searchParams?.page || "1") || 1);

  const where: any = { createdAt: { gte: from, lte: to } };
  if (chain) where.chain = chain;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { id: { contains: q } },
      { txHash: { contains: q } },
      { failureReason: { contains: q } },
      { user: { email: { contains: q } } },
    ];
  }
  if (asset) where.token = { symbol: asset };

  const [items, total] = await Promise.all([
    prisma.starDeposit.findMany({
      where,
      include: { user: true, token: true, package: true, custodialAddress: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.starDeposit.count({ where }),
  ]);

  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams || {})) {
    if (!v) continue;
    if (k === "page") continue;
    qp.set(k, String(v));
  }
  const exportHref = `/api/admin/payments/export/deposits?${qp.toString()}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">Total: {total}</div>
            <a className="text-sm text-blue-600 underline" href={exportHref}>
              Export CSV (filtered)
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => {
                const txUrl = d.txHash ? txExplorerUrl(d.chain, d.txHash) : "";
                const addrUrl = addressExplorerUrl(d.chain, d.custodialAddress.address);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">
                      <a className="text-blue-600 underline" href={`/admin/payments/deposits/${d.id}`}>{new Date(d.createdAt).toLocaleString()}</a>
                    </TableCell>
                    <TableCell>{d.chain}</TableCell>
                    <TableCell>{d.token?.symbol || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === "CREDITED" ? "default" : "secondary"}>{d.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate">{d.user?.email || "(none)"}</TableCell>
                    <TableCell className="text-right">{d.expectedAmount?.toString() || "-"}</TableCell>
                    <TableCell className="text-right">{d.actualAmount?.toString() || "-"}</TableCell>
                    <TableCell className="max-w-[260px] truncate">
                      {d.txHash ? (
                        <a className="text-blue-600 underline" href={txUrl} target="_blank" rel="noreferrer">
                          {d.txHash}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      <div className="text-xs">
                        <a className="text-blue-600 underline" href={addrUrl} target="_blank" rel="noreferrer">
                          {d.custodialAddress.address}
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between text-sm">
            <a
              className={`underline ${page <= 1 ? "pointer-events-none text-muted-foreground" : "text-blue-600"}`}
              href={`/admin/payments/deposits?${new URLSearchParams({ ...searchParams, page: String(page - 1) }).toString()}`}
            >
              Prev
            </a>
            <div>Page {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</div>
            <a
              className={`underline ${page * PAGE_SIZE >= total ? "pointer-events-none text-muted-foreground" : "text-blue-600"}`}
              href={`/admin/payments/deposits?${new URLSearchParams({ ...searchParams, page: String(page + 1) }).toString()}`}
            >
              Next
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
