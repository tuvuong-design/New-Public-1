import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Markdown from "@/components/docs/Markdown";
import { getDocBySlugParts } from "@/lib/docs/docs";

export const dynamic = "force-dynamic";

export default function AdminDocsIndex() {
  const doc = getDocBySlugParts(undefined);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Docs index</CardTitle>
              <CardDescription>Trang docs nội bộ (mkdocs-like) trong Admin.</CardDescription>
            </div>
            <Badge variant="secondary">/admin/docs</Badge>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {doc ? <Markdown source={doc.content} /> : <div className="text-sm text-zinc-500">No docs.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
