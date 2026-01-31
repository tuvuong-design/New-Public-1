import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TopupClient from "./TopupClient";

export const dynamic = "force-dynamic";

export default async function StarsTopupPage() {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;

  if (!uid) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="card">
          <div className="text-lg font-extrabold">Stars Topup</div>
          <div className="small muted mt-1">Vui lòng đăng nhập để nạp Stars.</div>
          <div className="mt-3"><a className="btn" href="/login">Login</a></div>
        </div>
      </main>
    );
  }

  const packages = await prisma.starTopupPackage.findMany({
    where: { active: true },
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
    include: { token: true },
    take: 50,
  });

  const dto = packages.map((p) => ({
    id: p.id,
    name: p.name,
    chain: String(p.chain),
    assetSymbol: p.token?.symbol ?? "TOKEN",
    expectedAmount: p.expectedAmount.toString(),
    stars: p.stars,
    bonusStars: (p as any).bonusStars ?? 0,
    bundleLabel: (p as any).bundleLabel ?? null,
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">Stars Topup</div>
        <div className="small muted mt-1">
          Trang này là contract path (không được đổi). Backend dùng worker reconcile qua queue <code>payments</code>.
        </div>
      </div>

      <TopupClient packages={dto} />

      <div className="card">
        <div className="small muted">
          Lưu ý: Production nên chạy <code>prisma migrate deploy</code>. Dev có thể dùng <code>prisma db push</code>.
        </div>
      </div>
    </main>
  );
}
