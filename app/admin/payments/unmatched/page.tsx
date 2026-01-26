import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import AssignUserInline from "./ui/AssignUserInline";

export default async function UnmatchedInboxPage() {
  const items = await prisma.starDeposit.findMany({
    where: { OR: [{ status: "UNMATCHED" }, { userId: null }] },
    include: { user: true, token: true, custodialAddress: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Unmatched inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Deposits with missing user match. Quickly assign a user by email.
          </p>
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
                <TableHead>Expected</TableHead>
                <TableHead>TxHash</TableHead>
                <TableHead>Assign</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap">
                    <a className="text-blue-600 underline" href={`/admin/payments/deposits/${d.id}`}>{new Date(d.createdAt).toLocaleString()}</a>
                  </TableCell>
                  <TableCell>{d.chain}</TableCell>
                  <TableCell>{d.token?.symbol || "-"}</TableCell>
                  <TableCell><Badge variant="danger">{d.status}</Badge></TableCell>
                  <TableCell className="text-right">{d.expectedAmount?.toString() || "-"}</TableCell>
                  <TableCell className="max-w-[240px] truncate font-mono text-xs">{d.txHash || "-"}</TableCell>
                  <TableCell>
                    <AssignUserInline depositId={d.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
