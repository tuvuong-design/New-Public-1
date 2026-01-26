import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminStorageEvents() {
  const rows = await prisma.nftEventLog.findMany({
    where: { action: { startsWith: "STORAGE_" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { id: true, email: true, name: true } } },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Storage events</CardTitle>
              <CardDescription>Audit log cho Storage config/apply/fallback. (NftEventLog action=STORAGE_*)</CardDescription>
            </div>
            <Badge variant="secondary">/admin/storage/events</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Actor</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{r.actor?.email || r.actorId || "-"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-medium">{r.action}</td>
                    <td className="py-2 pr-4">
                      <pre className="max-h-[220px] overflow-auto rounded-xl bg-zinc-50 p-2 text-xs">{r.dataJson}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-sm"><a className="underline" href="/admin/storage">Back to config</a></div>
        </CardContent>
      </Card>
    </div>
  );
}
