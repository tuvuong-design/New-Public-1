import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function AdminModerationKeywordsPage() {
  const rows = await prisma.creatorModerationSetting.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { creator: { select: { id: true, name: true, email: true } } },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Keyword filters</CardTitle>
              <CardDescription>
                CSV keywords (case-insensitive). Nếu comment chứa keyword → auto-hide (visibility=HIDDEN).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <a className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href="/admin/moderation">Back</a>
              <Badge variant="secondary">/admin/moderation/keywords</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Update / Add</CardTitle>
          <CardDescription>Nhập creatorId và keywords CSV (vd: spam, scam, xxx)</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/moderation/actions" method="post" className="grid gap-3">
            <input type="hidden" name="action" value="UPDATE_KEYWORDS" />
            <div className="grid gap-2">
              <Label htmlFor="creatorId">Creator ID</Label>
              <Input id="creatorId" name="creatorId" placeholder="cuid..." />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="keywordsCsv">Keywords CSV</Label>
              <Input id="keywordsCsv" name="keywordsCsv" placeholder="spam, scam, ..." />
            </div>
            <Button type="submit" variant="secondary">Save</Button>
          </form>
        </CardContent>
      </Card>

      {rows.length ? (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {r.creator?.name ?? r.creator?.email ?? r.creatorId}
                    </CardTitle>
                    <CardDescription>{r.creatorId} • updated {new Date(r.updatedAt).toLocaleString()}</CardDescription>
                  </div>
                  <form action="/api/admin/moderation/actions" method="post" className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="action" value="UPDATE_KEYWORDS" />
                    <input type="hidden" name="creatorId" value={r.creatorId} />
                    <Input name="keywordsCsv" defaultValue={r.keywordsCsv} className="w-[360px]" />
                    <Button type="submit" variant="secondary">Update</Button>
                  </form>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {r.keywordsCsv || <i>(empty)</i>}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">Chưa có keyword filter.</CardContent>
        </Card>
      )}
    </div>
  );
}
