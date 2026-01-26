import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminModerationActionsPage() {
  const list = await prisma.moderationAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      actor: { select: { id: true, name: true, email: true } },
      target: { select: { id: true, name: true, email: true, strikeCount: true, mutedUntil: true, bannedAt: true } },
      video: { select: { id: true, title: true } },
      comment: { select: { id: true, content: true, videoId: true } },
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Moderation actions audit</CardTitle>
              <CardDescription>300 bản ghi mới nhất (audit trail).</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <a className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href="/admin/moderation">Back</a>
              <Badge variant="secondary">/admin/moderation/actions</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">Chưa có action.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{a.type}</CardTitle>
                    <CardDescription>
                      {new Date(a.createdAt).toLocaleString()} • actor{" "}
                      <b>{a.actor?.name ?? a.actor?.email ?? a.actorUserId}</b>
                      {a.target ? (
                        <>
                          {" "}→ target <b>{a.target.name ?? a.target.email ?? a.target.id}</b>
                          {" "} (strikes {a.target.strikeCount})
                        </>
                      ) : null}
                    </CardDescription>
                    {a.reason ? <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.reason}</div> : null}
                    {a.video ? (
                      <div className="mt-2 text-sm">
                        Video: <a className="hover:underline" href={`/admin/videos/${a.video.id}`}>{a.video.title}</a>
                      </div>
                    ) : null}
                    {a.comment ? (
                      <div className="mt-2 text-sm">
                        Comment: <a className="hover:underline" href={`/v/${a.comment.videoId}`}>open video</a>{" "}
                        <span className="text-muted-foreground">({a.comment.id})</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
