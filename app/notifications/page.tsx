import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function typeLabel(t: string) {
  switch (t) {
    case "WEEKLY_DIGEST":
      return "Weekly digest";
    case "COMMENT_REPLY":
      return "Reply";
    case "VIDEO_LIKE":
      return "Like";
    case "VIDEO_COMMENT":
      return "Comment";
    case "NEW_SUBSCRIBER":
      return "Subscriber";
    case "STAR_GIFT":
      return "Stars";
    case "CREATOR_TIP":
      return "Tip";
    case "CREATOR_MEMBERSHIP":
      return "Fan Club";
    default:
      return t;
  }
}

export default async function NotificationsPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      url: true,
      isRead: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
    },
  });

  const unread = items.filter((x) => !x.isRead).length;

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                {unread} chưa đọc • hiển thị 200 mới nhất
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <a className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href="/settings/notifications">
                Settings
              </a>
              <form action="/api/me/notifications/read" method="post">
                <input type="hidden" name="all" value="1" />
                <button className="rounded-md border px-3 py-2 text-sm hover:bg-muted" type="submit">
                  Mark all read
                </button>
              </form>
            </div>
          </div>
        </CardHeader>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">Chưa có thông báo.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card key={n.id} className={n.isRead ? "" : "border-primary/40"}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={n.isRead ? "secondary" : "default"}>{typeLabel(n.type)}</Badge>
                      {n.actor ? <span className="text-sm text-muted-foreground">by {n.actor.name}</span> : null}
                      <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 font-semibold">{n.title}</div>
                    {n.body ? <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</div> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {n.url ? (
                      <a className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href={n.url}>
                        Open
                      </a>
                    ) : null}
                    {!n.isRead ? (
                      <form action="/api/me/notifications/read" method="post">
                        <input type="hidden" name="id" value={n.id} />
                        <button className="rounded-md border px-3 py-2 text-sm hover:bg-muted" type="submit">
                          Mark read
                        </button>
                      </form>
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
