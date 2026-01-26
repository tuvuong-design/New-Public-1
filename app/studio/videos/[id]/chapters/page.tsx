import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ChaptersEditor from "@/components/studio/ChaptersEditor";

export const dynamic = "force-dynamic";

export default async function StudioVideoChaptersPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!userId) redirect("/login");

  const video = await prisma.video.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, authorId: true },
  });
  if (!video) notFound();
  if (!isAdmin && video.authorId !== userId) redirect("/studio/analytics");

  const chapters = await prisma.videoChapter.findMany({
    where: { videoId: video.id },
    orderBy: { startSec: "asc" },
    take: 200,
    select: { startSec: true, title: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm text-neutral-500">Studio / Video / Chapters</div>
          <h2 className="text-2xl font-extrabold">{video.title}</h2>
          <div className="small muted mt-1">Tạo timestamps hiển thị dưới player.</div>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-muted" href={`/v/${video.id}`}>Open video</Link>
          <Link className="btn btn-muted" href={`/studio/videos/${video.id}/analytics`}>Analytics</Link>
          <Link className="btn btn-muted" href={`/studio/videos/${video.id}/seo`}>SEO</Link>
        </div>
      </div>

      <ChaptersEditor videoId={video.id} initial={chapters} />

      <div className="card small muted">
        Tip: đặt chapter 0s cho "Intro" sẽ đẹp hơn. Hệ thống tự sort theo startSec.
      </div>
    </div>
  );
}
