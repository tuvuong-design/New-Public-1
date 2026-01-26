export const dynamic = "force-dynamic";

export default async function MyChannelFollowers() {
  return (
    <div className="card p-4">
      <div className="text-lg font-bold">Người theo dõi</div>
      <div className="text-sm text-muted-foreground mt-1">
        Tính năng người theo dõi sẽ được mở rộng trong các phiên bản sau. (Đồng bộ hóa kênh/video đã có trong tab Đồng bộ hóa.)
      </div>
    </div>
  );
}
