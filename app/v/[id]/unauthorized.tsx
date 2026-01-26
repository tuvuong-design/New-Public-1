import { prisma } from "@/lib/prisma";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export const dynamic = "force-dynamic";

export default async function Unauthorized({ params }: { params: { id: string } }) {
  const v = await prisma.video.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, accessPasswordHint: true, thumbKey: true },
  });

  // If video does not exist, show a generic message. The page status remains 401,
  // but the main route will 404.
  const title = v?.title ?? "Video";
  const hint = v?.accessPasswordHint ?? "";
  const thumbUrl = resolveMediaUrl(v?.thumbKey ?? null);

  return (
    <main className="mx-auto max-w-xl px-3 py-4">
      <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
        {/* Blurred cover (PeerTube-ish) */}
        {thumbUrl ? (
          <div
            className="absolute inset-0 -z-10"
            style={{
              backgroundImage: `url(${thumbUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(18px)",
              transform: "scale(1.08)",
            }}
          />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-black/50" />

        {/* Warning strip */}
        <div className="flex items-center gap-2 bg-amber-500/95 px-4 py-3 text-amber-950">
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L1 21h22L12 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M12 9v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div className="text-sm font-extrabold tracking-wide">YÊU CẦU MẬT KHẨU</div>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-white/15 p-2 text-white ring-1 ring-white/20">
              <svg
                aria-hidden="true"
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 10V8a5 5 0 0110 0v2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M6 10h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 14v3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <div className="text-lg font-extrabold text-white">Video được bảo vệ bằng mật khẩu</div>
              <div className="mt-0.5 text-sm text-white/80">{title}</div>
              <div className="mt-2 text-xs text-white/70">
                Nhập mật khẩu để xem nội dung. Đây là cơ chế bảo vệ giống PeerTube.
              </div>
            </div>
          </div>

        {hint ? (
          <div className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-white ring-1 ring-white/15">
            <div className="text-xs font-extrabold tracking-wide text-white/90">GỢI Ý</div>
            <div className="mt-1 text-white/90">{hint}</div>
          </div>
        ) : null}

        <form className="mt-4 space-y-3" action={`/api/videos/${params.id}/unlock`} method="post">
          <input
            className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white placeholder:text-white/60"
            type="password"
            name="password"
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
            required
          />

          <button
            className="w-full rounded-xl bg-white px-4 py-2 font-extrabold text-black shadow-sm hover:opacity-95"
            type="submit"
          >
            Tôi hiểu và muốn xem
          </button>

          <div className="text-xs text-white/70">
            Nếu bạn có quyền truy cập, hãy nhập mật khẩu để xem video.
          </div>
        </form>
        </div>
      </div>
    </main>
  );
}
