import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminBoostPlans() {
  const list = await prisma.boostPlan.findMany({ orderBy: [{ sort: "asc" }, { createdAt: "desc" }] });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Boost plans</CardTitle>
              <CardDescription>
                Chỉnh giá boost theo ngày/tháng (DURATION) hoặc theo target tương tác (TARGET_INTERACTIONS).
              </CardDescription>
            </div>
            <Badge variant="secondary">/admin/boost/plans</Badge>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create / Update</CardTitle>
          <CardDescription>
            Nhập <b>Plan ID</b> để update; để trống để tạo mới.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/boost/plans" method="post" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="id">Plan ID</Label>
                <Input id="id" name="id" placeholder="(blank = create)" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="7 days / 10k views" required />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type" defaultValue="DURATION">
                  <option value="DURATION">DURATION</option>
                  <option value="TARGET_INTERACTIONS">TARGET_INTERACTIONS</option>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="priceStars">Price ⭐</Label>
                <Input id="priceStars" type="number" name="priceStars" defaultValue={100} min={1} required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sort">Sort</Label>
                <Input id="sort" type="number" name="sort" defaultValue={0} />
              </div>

              <div className="flex items-center gap-3 pt-8">
                <Checkbox id="active" name="active" defaultChecked />
                <Label htmlFor="active" className="cursor-pointer">Active</Label>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm">DURATION fields</CardTitle>
                  <CardDescription>Ví dụ: 1/7/30 ngày (tháng), tuỳ bạn đặt.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-2">
                    <Label htmlFor="durationDays">durationDays</Label>
                    <Input id="durationDays" type="number" name="durationDays" placeholder="e.g. 7" min={1} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm">TARGET_INTERACTIONS fields</CardTitle>
                  <CardDescription>Set 1 hoặc nhiều target, đạt target sẽ auto EXPIRED.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="targetViews">targetViews</Label>
                      <Input id="targetViews" type="number" name="targetViews" min={1} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="targetLikes">targetLikes</Label>
                      <Input id="targetLikes" type="number" name="targetLikes" min={1} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="targetShares">targetShares</Label>
                      <Input id="targetShares" type="number" name="targetShares" min={1} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="targetComments">targetComments</Label>
                      <Input id="targetComments" type="number" name="targetComments" min={1} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="submit">Save plan</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing plans</CardTitle>
          <CardDescription>Copy ID vào form phía trên để update nhanh.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">⭐ Price</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Targets</TableHead>
                <TableHead className="text-center">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell>{p.type}</TableCell>
                  <TableCell className="text-right tabular-nums">⭐ {p.priceStars}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.durationDays ?? "-"}</TableCell>
                  <TableCell className="text-right text-xs text-zinc-500">
                    {p.type === "TARGET_INTERACTIONS"
                      ? `V:${p.targetViews ?? "-"} L:${p.targetLikes ?? "-"} S:${p.targetShares ?? "-"} C:${p.targetComments ?? "-"}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center">{p.active ? "YES" : "NO"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
