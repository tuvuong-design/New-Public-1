import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const videos = await prisma.video.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      access: true,
      isSensitive: true,
      interactionsLocked: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-xl font-extrabold">Studio</div>
        <div className="small muted mt-1">
          Quản lý video của bạn: ẩn/xóa/đặt riêng tư hoặc chế độ "chỉ xem" (không tương tác).
        </div>
      </div>

      <form action="/api/studio/videos/bulk" method="post" className="card space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="small font-semibold">Access</div>
            <select name="access" className="input w-full">
              <option value="">(Không đổi)</option>
              <option value="PUBLIC">Public</option>
              <option value="PREMIUM_PLUS">Premium+ only</option>
              <option value="PRIVATE">Private (owner/admin)</option>
              <option value="VIOLATOR_ONLY">Chỉ xem (không tương tác)</option>
            </select>
            <div className="small muted">"Chỉ xem" sẽ tự động tắt tương tác.</div>
          </div>

          <div className="space-y-1">
            <div className="small font-semibold">Status</div>
            <select name="status" className="input w-full">
              <option value="">(Không đổi)</option>
              <option value="PUBLISHED">Published</option>
              <option value="HIDDEN">Hidden</option>
              <option value="DELETED">Deleted (soft)</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="small font-semibold">Sensitive</div>
            <select name="sensitive" className="input w-full">
              <option value="">(Không đổi)</option>
              <option value="true">Đánh dấu Sensitive</option>
              <option value="false">Bỏ Sensitive</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="small font-semibold">Tương tác</div>
            <select name="interactionsLocked" className="input w-full">
              <option value="">(Không đổi)</option>
              <option value="true">Tắt tương tác</option>
              <option value="false">Bật tương tác</option>
            </select>
          </div>
        </div>

        <label className="small inline-flex items-center gap-2">
          <input type="checkbox" name="applyToAll" value="1" />
          Áp dụng cho tất cả video của tôi (không cần tick)
        </label>

        <div className="flex gap-2">
          <button className="btn" type="submit">
            Áp dụng
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Chọn</th>
                <th className="py-2 text-left">Tiêu đề</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Access</th>
                <th className="py-2 text-left">Sensitive</th>
                <th className="py-2 text-left">Tương tác</th>
                <th className="py-2 text-left">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-b">
                  <td className="py-2">
                    <input type="checkbox" name="videoIds" value={v.id} />
                  </td>
                  <td className="py-2">
                    <a className="link" href={`/v/${v.id}`}>
                      {v.title}
                    </a>
                  </td>
                  <td className="py-2">{v.status}</td>
                  <td className="py-2">{v.access}</td>
                  <td className="py-2">{v.isSensitive ? "Yes" : "No"}</td>
                  <td className="py-2">{v.interactionsLocked ? "Locked" : "On"}</td>
                  <td className="py-2">{new Date(v.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
