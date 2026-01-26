import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Markdown from "@/components/docs/Markdown";
import { getDocBySlugParts } from "@/lib/docs/docs";

export const dynamic = "force-dynamic";

export default function AdminDocsPage({ params }: { params: { slug: string[] } }) {
  const doc = getDocBySlugParts(params.slug);
  if (!doc) return notFound();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{doc.title}</CardTitle>
              <CardDescription>
                File: <span className="font-mono text-xs">docs/{doc.file}</span>
              </CardDescription>
            </div>
            <Badge variant="secondary">/admin/docs/{doc.slug}</Badge>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Markdown source={doc.content} />
        </CardContent>
      </Card>
    </div>
  );
}
