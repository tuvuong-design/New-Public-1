import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminStarTx({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const userId = String(searchParams.userId || "").trim();
  const email = String(searchParams.email || "").trim();
  const type = String(searchParams.type || "").trim();
  const from = String(searchParams.from || "").trim();
  const to = String(searchParams.to || "").trim();
  const take = Math.min(500, Math.max(10, Number(searchParams.take || 200)));

  const where: any = {};
  if (type) where.type = type;
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  if (email && !userId) {
    const u = await prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (u) where.userId = u.id;
  }

  const list = await prisma.starTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { id: true, email: true, name: true } },
      video: { select: { id: true, title: true } },
      gift: { select: { name: true, icon: true, starsCost: true } },
    },
  });

  const exportHref = `/api/admin/stars/export/ledger?${new URLSearchParams({
    ...(userId ? { userId } : {}),
    ...(email ? { email } : {}),
    ...(type ? { type } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    take: String(take),
  }).toString()}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Stars ledger</CardTitle>
            <div className="flex items-center gap-2">
              <a className="text-sm underline" href={exportHref}>Export CSV</a>
              <a className="text-sm" href="/admin/stars">Back</a>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <Label>Email</Label>
              <Input name="email" defaultValue={email} placeholder="user@example.com" />
            </div>
            <div className="md:col-span-1">
              <Label>UserId</Label>
              <Input name="userId" defaultValue={userId} placeholder="cuid" />
            </div>
            <div className="md:col-span-1">
              <Label>Type</Label>
              <Select name="type" defaultValue={type}>
                <option value="">(any)</option>
                <option value="TOPUP">TOPUP</option>
                <option value="REFUND">REFUND</option>
                <option value="GIFT">GIFT</option>
                <option value="CREATOR_TIP">CREATOR_TIP</option>
                <option value="CREATOR_MEMBERSHIP_PURCHASE">CREATOR_MEMBERSHIP_PURCHASE</option>
                <option value="ADMIN_GRANT">ADMIN_GRANT</option>
                <option value="ADMIN_DEDUCT">ADMIN_DEDUCT</option>
                <option value="NFT_SALE">NFT_SALE</option>
                <option value="NFT_MINT">NFT_MINT</option>
              </Select>
            </div>
            <div>
              <Label>From</Label>
              <Input name="from" defaultValue={from} placeholder="2026-01-01" />
            </div>
            <div>
              <Label>To</Label>
              <Input name="to" defaultValue={to} placeholder="2026-01-31" />
            </div>
            <div className="md:col-span-6 flex items-center gap-2">
              <Label className="sr-only">Take</Label>
              <Input name="take" defaultValue={String(take)} className="w-[110px]" />
              <Button type="submit" variant="secondary">Filter</Button>
              <a className="text-sm underline" href="/admin/stars/transactions">Reset</a>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="card">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Time</th>
            <th align="left">User</th>
            <th align="left">Type</th>
            <th align="left">Delta</th>
            <th align="left">Video</th>
            <th align="left">Gift</th>
            <th align="left">Note</th>
          </tr>
        </thead>
        <tbody>
          {list.map((t) => (
            <tr key={t.id} style={{ borderTop: "1px solid #eee" }}>
              <td className="small muted">{new Date(t.createdAt).toLocaleString()}</td>
              <td className="small">{t.user ? (<a className="underline" href={`/admin/users?query=${encodeURIComponent(t.user.email ?? t.user.id)}`}>{t.user.email ?? t.user.id}</a>) : "-"}</td>
              <td className="small"><b>{t.type}</b></td>
              <td className="small">{t.delta}</td>
              <td className="small">{t.video ? <a href={`/v/${t.video.id}`}>{t.video.title}</a> : "-"}</td>
              <td className="small">{t.gift ? `${t.gift.icon ?? ""} ${t.gift.name} (${t.gift.starsCost})` : "-"}</td>
              <td className="small muted">{t.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
