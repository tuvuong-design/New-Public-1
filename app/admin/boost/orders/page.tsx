import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminBoostOrders() {
  const list = await prisma.boostOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true } },
      video: { select: { id: true, title: true } },
      plan: true,
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Boost orders</CardTitle>
              <CardDescription>Quản lý trạng thái boost + xem báo cáo tương tác (200 mới nhất).</CardDescription>
            </div>
            <Badge variant="secondary">/admin/boost/orders</Badge>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Plan</TableHead>
                <TableHead className="text-right">⭐ Price</TableHead>
                <TableHead className="text-right">Δ views</TableHead>
                <TableHead className="text-right">Δ likes</TableHead>
                <TableHead className="text-right">Δ shares</TableHead>
                <TableHead className="text-right">Δ cmt</TableHead>
                <TableHead className="text-right">Δ ⭐</TableHead>
                <TableHead className="text-right">Δ 🎁</TableHead>
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="max-w-[360px]">
                    <a href={`/v/${o.videoId}`} className="font-semibold hover:underline line-clamp-2">
                      {o.video.title}
                    </a>
                    <div className="text-xs text-zinc-500">
                      {new Date(o.startAt).toLocaleString()} → {o.endAt ? new Date(o.endAt).toLocaleString() : "-"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.user.name ?? o.user.email ?? o.user.id}
                  </TableCell>
                  <TableCell className="font-semibold">{o.status}</TableCell>
                  <TableCell className="text-right">{o.plan.name}</TableCell>
                  <TableCell className="text-right tabular-nums">⭐ {o.priceStars}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.statViews}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.statLikes}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.statShares}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.statComments}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.statStars}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.statGifts}</TableCell>
                  <TableCell className="text-right">
                    <form action="/api/admin/boost/orders" method="post" className="flex items-end justify-end gap-2">
                      <input type="hidden" name="id" value={o.id} />
                      <div className="grid gap-2">
                        <Label htmlFor={`status-${o.id}`}>Status</Label>
                        <Select id={`status-${o.id}`} name="status" defaultValue={o.status} className="w-[150px]">
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="PAUSED">PAUSED</option>
                          <option value="CANCELED">CANCELED</option>
                          <option value="EXPIRED">EXPIRED</option>
                        </Select>
                      </div>
                      <Button type="submit" variant="secondary">Update</Button>
                    </form>
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
