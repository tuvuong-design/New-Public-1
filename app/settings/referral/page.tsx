import { auth } from "@/lib/auth";
import ReferralClient from "./ui/ReferralClient";

export const runtime = "nodejs";

export default async function ReferralPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="container py-10">
        <div className="card">
          <div className="text-lg font-extrabold">Referral</div>
          <div className="small muted mt-2">Bạn cần đăng nhập.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">Referral Stars</div>
        <div className="small muted mt-1">
          Mời bạn bè bằng referral code. Nếu bạn bè đã được gắn referrer, khi họ nạp hoặc kiếm Stars,
          hệ thống sẽ thưởng % Stars cho bạn (admin cấu hình 1–20%).
        </div>
      </div>

      <ReferralClient />
    </div>
  );
}
