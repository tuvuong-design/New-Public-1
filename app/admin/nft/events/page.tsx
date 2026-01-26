import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminNftEventsPage() {
  const logs = await prisma.nftEventLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { id: true, name: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-lg font-semibold">NFT Event Logs</div>
        <div className="small muted">Audit trail cho mint/listing/auction/export.</div>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Actor</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-zinc-200/60 dark:border-zinc-800/60">
                <td className="py-2 pr-3 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{l.actor?.name || l.actorId}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{l.action}</td>
                <td className="py-2 pr-3">
                  <pre className="whitespace-pre-wrap text-xs muted">{l.dataJson || ""}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
