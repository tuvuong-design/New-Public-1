import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

function statusColor(s: string) {
  switch (s) {
    case "OPEN":
      return "bg-red-100 text-red-700";
    case "REVIEWED":
      return "bg-yellow-100 text-yellow-800";
    case "RESOLVED":
      return "bg-green-100 text-green-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default async function AdminCommentReports() {
  const list = await prisma.commentReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      comment: { select: { id: true, content: true, videoId: true, userId: true, visibility: true } },
      reporter: { select: { id: true, name: true, email: true } },
    },
  });

  const videos = list.length
    ? await prisma.video.findMany({
        where: { id: { in: Array.from(new Set(list.map((r) => r.comment.videoId))) } },
        select: { id: true, title: true },
      })
    : [];
  const videoMap = new Map(videos.map((v) => [v.id, v]));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Comment Reports</CardTitle>
              <CardDescription>Báo cáo bình luận (tối đa 200 mới nhất)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có báo cáo.</p>
          ) : (
            <div className="space-y-4">
              {list.map((r) => {
                const v = videoMap.get(r.comment.videoId);
                return (
                  <div key={r.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className={statusColor(r.status)}>{r.status}</Badge>
                        <span className="text-sm text-muted-foreground">
                          Reporter: {r.reporter?.name || r.reporter?.email || r.reporterId}
                        </span>
                      </div>
                      <form action="/api/admin/reports/comments" method="post" className="flex items-center gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <Label className="text-sm">Status</Label>
                        <Select name="status" defaultValue={r.status}>
                          <option value="OPEN">OPEN</option>
                          <option value="REVIEWED">REVIEWED</option>
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="REJECTED">REJECTED</option>
                        </Select>
                        <button className="rounded-md border px-3 py-1 text-sm hover:bg-muted" type="submit">
                          Cập nhật
                        </button>
                      </form>
                                            <div className="flex flex-wrap items-center gap-2">
                        <form action="/api/admin/moderation/actions" method="post">
                          <input type="hidden" name="action" value={r.comment.visibility === "HIDDEN" ? "UNHIDE_COMMENT" : "HIDE_COMMENT"} />
                          <input type="hidden" name="commentId" value={r.comment.id} />
                          <button className="rounded-md border px-3 py-1 text-sm hover:bg-muted" type="submit">
                            {r.comment.visibility === "HIDDEN" ? "Unhide" : "Hide"}
                          </button>
                        </form>
                        {r.comment.userId ? (
                          <>
                            <form action="/api/admin/moderation/actions" method="post">
                              <input type="hidden" name="action" value="STRIKE_USER" />
                              <input type="hidden" name="targetUserId" value={r.comment.userId} />
                              <button className="rounded-md border px-3 py-1 text-sm hover:bg-muted" type="submit">Strike</button>
                            </form>
                            <form action="/api/admin/moderation/actions" method="post">
                              <input type="hidden" name="action" value="MUTE_USER_7D" />
                              <input type="hidden" name="targetUserId" value={r.comment.userId} />
                              <button className="rounded-md border px-3 py-1 text-sm hover:bg-muted" type="submit">Mute 7d</button>
                            </form>
                            <form action="/api/admin/moderation/actions" method="post">
                              <input type="hidden" name="action" value="BAN_USER" />
                              <input type="hidden" name="targetUserId" value={r.comment.userId} />
                              <input type="hidden" name="reason" value="Report review" />
                              <button className="rounded-md border px-3 py-1 text-sm hover:bg-muted" type="submit">Ban</button>
                            </form>
                          </>
                        ) : null}
                      </div>

                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">Video:</span>{" "}
                        {v ? (
                          <a className="underline" href={`/v/${v.id}`}>
                            {v.title}
                          </a>
                        ) : (
                          r.comment.videoId
                        )}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Comment:</span> {r.comment.content}
                      </p>
                      {r.reason ? (
                        <p className="text-sm">
                          <span className="font-medium">Reason:</span> {r.reason}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
