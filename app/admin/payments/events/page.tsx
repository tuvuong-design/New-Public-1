import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 50;

export default async function DepositEventsPage({
  searchParams,
}: {
  searchParams?: { depositId?: string; type?: string; q?: string; from?: string; to?: string; page?: string };
}) {
  const depositId = (searchParams?.depositId || "").trim();
  const type = (searchParams?.type || "").trim();
  const q = (searchParams?.q || "").trim();
  const from = searchParams?.from ? new Date(searchParams.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = searchParams?.to ? new Date(searchParams.to) : new Date();
  const page = Math.max(1, Number(searchParams?.page || "1") || 1);

  const where: any = { createdAt: { gte: from, lte: to } };
  if (depositId) where.depositId = depositId;
  if (type) where.type = type;
  if (q) {
    where.OR = [{ message: { contains: q } }, { type: { contains: q } }, { depositId: { contains: q } }];
  }

  const [items, total] = await Promise.all([
    prisma.starDepositEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.starDepositEvent.count({ where }),
  ]);

  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams || {})) {
    if (!v) continue;
    if (k === "page") continue;
    qp.set(k, String(v));
  }
  const exportHref = `/api/admin/payments/export/events?${qp.toString()}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deposit events</CardTitle>
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
                <TableHead>Deposit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    <a className="text-blue-600 underline" href={`/admin/payments/deposits/${e.depositId}`}>{e.depositId}</a>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.type}</TableCell>
                  <TableCell className="max-w-[720px] truncate">{e.message || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between text-sm">
            <a
              className={`underline ${page <= 1 ? "pointer-events-none text-muted-foreground" : "text-blue-600"}`}
              href={`/admin/payments/events?${new URLSearchParams({ ...searchParams, page: String(page - 1) }).toString()}`}
            >
              Prev
            </a>
            <div>Page {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</div>
            <a
              className={`underline ${page * PAGE_SIZE >= total ? "pointer-events-none text-muted-foreground" : "text-blue-600"}`}
              href={`/admin/payments/events?${new URLSearchParams({ ...searchParams, page: String(page + 1) }).toString()}`}
            >
              Next
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
