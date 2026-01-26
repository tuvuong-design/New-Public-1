import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditorTrimPanel from "@/components/studio/EditorTrimPanel";

export const dynamic = "force-dynamic";

export default async function StudioEditorPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const videos = await prisma.video.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, durationSec: true, status: true, createdAt: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-zinc-500">Studio / Editor</div>
        <h2 className="text-2xl font-extrabold">Video Editor (Trim)</h2>
        <div className="small muted mt-1">Trim source video trên worker (ffmpeg) rồi chạy lại pipeline HLS/thumbnail.</div>
      </div>

      <EditorTrimPanel
        videos={videos.map((v) => ({
          id: v.id,
          title: v.title,
          durationSec: v.durationSec,
          status: v.status,
          createdAt: v.createdAt.toISOString(),
        }))}
      />

      <div className="card small muted">
        Lưu ý: editor MVP chỉ hỗ trợ trim. Video sẽ quay lại trạng thái PROCESSING và worker sẽ re-encode.
      </div>
    </div>
  );
}
