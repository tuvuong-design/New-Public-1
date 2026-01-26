import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { txExplorerUrl, addressExplorerUrl } from "@/lib/payments/explorer";
import DepositDetailActions from "./ui/DepositDetailActions";

export default async function DepositDetailPage({ params }: { params: { id: string } }) {
  const dep = await prisma.starDeposit.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      token: true,
      package: true,
      custodialAddress: true,
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      webhooks: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!dep) return notFound();

  const txUrl = dep.txHash ? txExplorerUrl(dep.chain, dep.txHash) : "";
  const addrUrl = addressExplorerUrl(dep.chain, dep.custodialAddress.address);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deposit detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Deposit ID</div>
              <div className="font-mono text-xs break-all">{dep.id}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Status</div>
              <div><Badge>{dep.status}</Badge></div>
            </div>
            <div>
              <div className="text-muted-foreground">Chain / Asset</div>
              <div>{dep.chain} / {dep.token?.symbol || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Provider</div>
              <div>{dep.provider}</div>
            </div>
            <div>
              <div className="text-muted-foreground">User</div>
              <div>{dep.user?.email || "(none)"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Custodial address</div>
              <div className="break-all">
                <a className="text-blue-600 underline" href={addrUrl} target="_blank" rel="noreferrer">{dep.custodialAddress.address}</a>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Expected / Actual</div>
              <div>{dep.expectedAmount?.toString() || "-"} / {dep.actualAmount?.toString() || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Tx Hash</div>
              <div className="break-all">
                {dep.txHash ? (
                  <a className="text-blue-600 underline" href={txUrl} target="_blank" rel="noreferrer">{dep.txHash}</a>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </div>
            {dep.failureReason ? (
              <div className="md:col-span-2">
                <div className="text-muted-foreground">Failure reason</div>
                <div className="text-red-600 break-all">{dep.failureReason}</div>
              </div>
            ) : null}
          </div>

          <DepositDetailActions depositId={dep.id} currentStatus={dep.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dep.events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{e.type}</TableCell>
                  <TableCell className="max-w-[720px] truncate">{e.message || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook logs (recent)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dep.webhooks.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="whitespace-nowrap">{new Date(w.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{w.provider}</TableCell>
                  <TableCell><Badge variant={w.status === "REJECTED" ? "danger" : "secondary"}>{w.status}</Badge></TableCell>
                  <TableCell className="max-w-[720px] truncate">{w.failureReason || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
