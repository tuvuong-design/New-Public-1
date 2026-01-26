import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MyChannelHome() {
  return (
    <div className="card p-4">
      <div className="text-lg font-bold">Quản lý kênh</div>
      <div className="text-sm text-muted-foreground mt-1">
        Trang này đang được tối ưu dần theo phong cách PeerTube. Hiện bạn có thể quản lý video trong Studio và cấu hình đồng bộ trong tab “Đồng bộ hóa”.
      </div>
      <div className="mt-3 flex gap-2">
        <Link href="/studio" className="btn">Mở Studio</Link>
        <Link href="/my-channel/sync" className="btn">Đồng bộ hóa</Link>
      </div>
    </div>
  );
}
