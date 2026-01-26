import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

export default async function AdminReports() {
  const list = await prisma.videoReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      video: { select: { id: true, title: true, status: true, authorId: true, author: { select: { id: true, name: true, email: true } } } },
      reporter: { select: { id: true, name: true, email: true } },
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Video reports</CardTitle>
              <CardDescription>Quản lý báo cáo vi phạm (200 mới nhất).</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <a className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href="/admin/reports/comments">Comment Reports</a>
            </div>
            <Badge variant="secondary">/admin/reports</Badge>
          </div>
        </CardHeader>
      </Card>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-zinc-500">Chưa có báo cáo.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {list.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      <a href={`/v/${r.videoId}`} className="hover:underline">
                        {r.video.title}
                      </a>
                    </CardTitle>
                    <CardDescription>
                      {new Date(r.createdAt).toLocaleString()} • status <b>{r.status}</b> • by{" "}
                      {r.reporter ? r.reporter.name ?? r.reporter.email ?? r.reporter.id : "Guest"}
                    </CardDescription>
                  </div>

                  <form action="/api/admin/reports" method="post" className="flex items-end gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="grid gap-2">
                      <Label htmlFor={`status-${r.id}`}>Status</Label>
                      <Select id={`status-${r.id}`} name="status" defaultValue={r.status} className="w-[180px]">
                        <option value="OPEN">OPEN</option>
                        <option value="REVIEWED">REVIEWED</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="REJECTED">REJECTED</option>
                      </Select>
                    </div>
                    <Button type="submit" variant="secondary">Update</Button>
                  </form>

                  <div className="flex flex-wrap items-end gap-2">
                    <form action="/api/admin/moderation/actions" method="post">
                      <input type="hidden" name="action" value={r.video.status === "HIDDEN" ? "UNHIDE_VIDEO" : "HIDE_VIDEO"} />
                      <input type="hidden" name="videoId" value={r.videoId} />
                      <Button type="submit" variant="outline">
                        {r.video.status === "HIDDEN" ? "Unhide video" : "Hide video"}
                      </Button>
                    </form>

                    {r.video.authorId ? (
                      <>
                        <form action="/api/admin/moderation/actions" method="post">
                          <input type="hidden" name="action" value="STRIKE_USER" />
                          <input type="hidden" name="targetUserId" value={r.video.authorId} />
                          <Button type="submit" variant="secondary">Strike</Button>
                        </form>
                        <form action="/api/admin/moderation/actions" method="post">
                          <input type="hidden" name="action" value="MUTE_USER_7D" />
                          <input type="hidden" name="targetUserId" value={r.video.authorId} />
                          <Button type="submit" variant="secondary">Mute 7d</Button>
                        </form>
                        <form action="/api/admin/moderation/actions" method="post">
                          <input type="hidden" name="action" value="BAN_USER" />
                          <input type="hidden" name="targetUserId" value={r.video.authorId} />
                          <input type="hidden" name="reason" value="Report review" />
                          <Button type="submit" variant="destructive">Ban</Button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs text-zinc-500">Reason</div>
                  <div className="text-sm font-semibold">{r.reason}</div>
                </div>
                {r.details ? (
                  <div>
                    <div className="text-xs text-zinc-500">Details</div>
                    <div className="whitespace-pre-wrap text-sm">{r.details}</div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
