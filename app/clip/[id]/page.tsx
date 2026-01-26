import { prisma } from "@/lib/prisma";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { canViewVideoDb } from "@/lib/videoAccessDb";
import VideoPlayer from "@/components/player/VideoPlayer";

export const runtime = "nodejs";

export default async function ClipPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";

  const clip = await prisma.clip.findUnique({
    where: { id: params.id },
    include: {
      video: {
        select: {
          id: true,
          title: true,
          status: true,
          access: true,
          authorId: true,
          interactionsLocked: true,
        },
      },
      creator: { select: { id: true, name: true, username: true } },
    },
  });

  if (!clip || clip.status === "DELETED") {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Clip không tồn tại</h1>
        <p className="mt-2 text-sm text-muted-foreground">Clip có thể đã bị xóa hoặc link không đúng.</p>
        <div className="mt-4">
          <Link className="underline" href="/">
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const canAlways = Boolean(isAdmin || (viewerId && viewerId === clip.creatorId));
  const gateRow = clip.video
    ? ({
        id: clip.video.id,
        status: clip.video.status as any,
        access: (clip.video.access ?? "PUBLIC") as any,
        authorId: clip.video.authorId,
        interactionsLocked: Boolean(clip.video.interactionsLocked),
      } as any)
    : null;

  const canView = canAlways || (gateRow ? await canViewVideoDb(gateRow, session) : false);

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Clip bị hạn chế</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bạn không có quyền xem clip này (clip kế thừa quyền truy cập của video gốc).
        </p>
        <div className="mt-4">
          <Link className="underline" href={viewerId ? `/v/${clip.videoId}` : `/login?next=/clip/${clip.id}`}>
            {viewerId ? "Mở video gốc" : "Đăng nhập"}
          </Link>
        </div>
      </div>
    );
  }

  const url = clip.outputKey ? resolveMediaUrl(clip.outputKey) : null;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{clip.title || "Clip"}</h1>
        <div className="text-sm text-muted-foreground">
          từ video{" "}
          <Link className="underline" href={`/v/${clip.videoId}`}>
            {clip.video?.title || clip.videoId}
          </Link>{" "}
          · tạo bởi <span className="font-medium">{clip.creator?.name || clip.creator?.username || "Người dùng"}</span>
        </div>
      </div>

      {clip.status !== "READY" ? (
        <div className="rounded border p-4 text-sm">
          Clip đang xử lý ({clip.status}). Vui lòng tải lại sau ít phút.
          {clip.status === "ERROR" && clip.errorMessage ? <div className="mt-2 text-red-400">{clip.errorMessage}</div> : null}
        </div>
      ) : !url ? (
        <div className="rounded border p-4 text-sm text-red-400">Thiếu file clip.</div>
      ) : (
        <VideoPlayer src={url} poster={undefined} autoPlay={false} muted={false} loop={false} mode="standard" preload="metadata" />
      )}

      <div className="rounded border p-4 text-sm">
        <div className="font-medium">Chia sẻ</div>
        <div className="mt-1 break-all text-muted-foreground">{`/clip/${clip.id}`}</div>
      </div>
    </div>
  );
}
