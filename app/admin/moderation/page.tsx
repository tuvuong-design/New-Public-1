import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default function AdminModerationPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Moderation</CardTitle>
            <Badge variant="secondary">/admin/moderation</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <a className="rounded-md border px-3 py-2 hover:bg-muted" href="/admin/reports">Video reports</a>
            <a className="rounded-md border px-3 py-2 hover:bg-muted" href="/admin/reports/comments">Comment reports</a>
            <a className="rounded-md border px-3 py-2 hover:bg-muted" href="/admin/moderation/actions">Actions audit</a>
            <a className="rounded-md border px-3 py-2 hover:bg-muted" href="/admin/moderation/keywords">Keyword filters</a>
          </div>
          <p className="text-muted-foreground">
            Tips: xử lý report → áp action (hide/strike/mute/ban) và luôn có audit trail trong “Actions audit”.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
