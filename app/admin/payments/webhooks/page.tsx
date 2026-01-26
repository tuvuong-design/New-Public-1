import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 50;

export default async function WebhookLogsPage({
  searchParams,
}: {
  searchParams?: { provider?: string; status?: string; chain?: string; q?: string; from?: string; to?: string; page?: string };
}) {
  const provider = (searchParams?.provider || "").trim();
  const status = (searchParams?.status || "").trim();
  const chain = (searchParams?.chain || "").trim();
  const q = (searchParams?.q || "").trim();
  const from = searchParams?.from ? new Date(searchParams.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = searchParams?.to ? new Date(searchParams.to) : new Date();
  const page = Math.max(1, Number(searchParams?.page || "1") || 1);

  const where: any = { createdAt: { gte: from, lte: to } };
  if (provider) where.provider = provider;
  if (status) where.status = status;
  if (chain) where.chain = chain;
  if (q) {
    where.OR = [{ depositId: { contains: q } }, { sha256: { contains: q } }, { failureReason: { contains: q } }, { endpoint: { contains: q } }];
  }

  const [items, total] = await Promise.all([
    prisma.webhookAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.webhookAuditLog.count({ where }),
  ]);

  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams || {})) {
    if (!v) continue;
    if (k === "page") continue;
    qp.set(k, String(v));
  }
  const exportHref = `/api/admin/payments/export/webhooks?${qp.toString()}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Webhook logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">Total: {total}</div>
            <a className="text-sm text-blue-600 underline" href={exportHref}>Export CSV (filtered)</a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="whitespace-nowrap">{new Date(w.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{w.provider}</TableCell>
                  <TableCell>{w.chain || "-"}</TableCell>
                  <TableCell className="max-w-[220px] truncate font-mono text-xs">{w.endpoint}</TableCell>
                  <TableCell><Badge variant={w.status === "REJECTED" ? "danger" : "secondary"}>{w.status}</Badge></TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {w.depositId ? <a className="text-blue-600 underline" href={`/admin/payments/deposits/${w.depositId}`}>{w.depositId}</a> : "-"}
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate">{w.failureReason || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between text-sm">
            <a
              className={`underline ${page <= 1 ? "pointer-events-none text-muted-foreground" : "text-blue-600"}`}
              href={`/admin/payments/webhooks?${new URLSearchParams({ ...searchParams, page: String(page - 1) }).toString()}`}
            >
              Prev
            </a>
            <div>Page {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</div>
            <a
              className={`underline ${page * PAGE_SIZE >= total ? "pointer-events-none text-muted-foreground" : "text-blue-600"}`}
              href={`/admin/payments/webhooks?${new URLSearchParams({ ...searchParams, page: String(page + 1) }).toString()}`}
            >
              Next
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
