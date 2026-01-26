import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SeoPanel from "./SeoPanel";

export const dynamic = "force-dynamic";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function scoreVideo(v: { title: string; description: string; tagCount: number; hasThumb: boolean; hasCategory: boolean }) {
  const tips: string[] = [];
  let score = 0;

  const titleLen = v.title.trim().length;
  if (titleLen >= 20 && titleLen <= 70) score += 25;
  else {
    score += 10;
    tips.push("Title nên ~20–70 ký tự (dễ click và không bị cắt)."
    );
  }

  const descLen = v.description.trim().length;
  if (descLen >= 120) score += 25;
  else {
    score += clamp(Math.floor((descLen / 120) * 25), 0, 20);
    tips.push("Description nên >= 120 ký tự để SEO tốt (từ khoá + context)."
    );
  }

  if (v.tagCount >= 5 && v.tagCount <= 15) score += 20;
  else {
    score += clamp(Math.min(v.tagCount, 15), 0, 15);
    tips.push("Tags nên 5–15 tag liên quan. Tránh quá ít hoặc quá nhiều."
    );
  }

  if (v.hasThumb) score += 20;
  else tips.push("Nên có thumbnail (CTR tốt hơn)."
  );

  if (v.hasCategory) score += 10;
  else tips.push("Chọn category giúp discovery tốt hơn."
  );

  return { score: clamp(score, 0, 100), tips };
}

export default async function StudioVideoSeoPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  const uid = (session.user as any)?.id as string | undefined;

  const v = await prisma.video.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      authorId: true,
      title: true,
      description: true,
      thumbKey: true,
      categoryId: true,
      tags: { select: { tag: { select: { slug: true, name: true } } } },
    },
  });
  if (!v) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not found</CardTitle>
        </CardHeader>
      </Card>
    );
  }
  if (v.authorId !== uid && !isAdmin(session)) redirect("/studio");

  const tagsStr = v.tags
    .map((t) => t.tag.slug || t.tag.name)
    .filter(Boolean)
    .join(", ");

  const { score, tips } = scoreVideo({
    title: v.title,
    description: v.description,
    tagCount: v.tags.length,
    hasThumb: Boolean(v.thumbKey),
    hasCategory: Boolean(v.categoryId),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm text-zinc-500">Video SEO</div>
          <div className="text-xl font-semibold">{v.title}</div>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn" href={`/studio/videos/${v.id}/analytics`}>
            Analytics
          </Link>
          <Link className="btn" href={`/studio/videos/${v.id}/chapters`}>
            Chapters
          </Link>
          <a className="btn" href={`/admin/videos/${v.id}`}>
            Admin Metadata
          </a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SEO Score</CardTitle>
          <CardDescription>Heuristic scoring để tối ưu title/description/tags. Không thay thế SEO thực tế.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "destructive"}>{score}/100</Badge>
            <span className="text-sm text-zinc-600">
              {score >= 80 ? "Good" : score >= 60 ? "OK" : "Needs work"}
            </span>
          </div>
          {tips.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
              {tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-zinc-600">Looks good 🎯</div>
          )}
        </CardContent>
      </Card>

      <SeoPanel videoId={v.id} baseTags={tagsStr} />
    </div>
  );
}
