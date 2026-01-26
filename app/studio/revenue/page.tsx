import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

export default async function StudioRevenuePage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const tips = await prisma.creatorTip.findMany({
    where: { toUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { fromUser: { select: { id: true, name: true } } },
  });

  const total = tips.reduce((s, t) => s + t.stars, 0);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-zinc-500">Studio / Revenue</div>
        <h2 className="text-2xl font-extrabold">Creator tips</h2>
        <div className="small muted mt-1">Tổng nhận: ⭐ {fmt(total)} (100 lần gần nhất)</div>
      </div>

      <div className="card">
        <div className="text-lg font-extrabold">Recent tips</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2">Time</th>
                <th className="py-2">From</th>
                <th className="py-2">Stars</th>
                <th className="py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {tips.length === 0 ? (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={4}>
                    No tips yet.
                  </td>
                </tr>
              ) : (
                tips.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-2 whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="py-2">{t.fromUser?.name ?? "(unknown)"}</td>
                    <td className="py-2 font-semibold">⭐ {fmt(t.stars)}</td>
                    <td className="py-2">{t.message ?? ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card small muted">Payouts (rút tiền) sẽ làm ở phase sau. Hiện tại chỉ ghi nhận doanh thu theo sao.</div>
    </div>
  );
}
