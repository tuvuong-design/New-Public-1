import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StarsTopupPage() {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;

  if (!uid) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="card">
          <div className="text-lg font-extrabold">Stars Topup</div>
          <div className="small muted mt-1">Vui lòng đăng nhập để nạp Stars.</div>
          <div className="mt-3"><a className="btn" href="/login">Login</a></div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">Stars Topup</div>
        <div className="small muted mt-1">
          Trang này là contract path (không được đổi). UI topup có thể được mở rộng theo roadmap; backend đã có APIs:
          <div className="mt-2">
            <code className="small">POST /api/stars/topup/intent</code><br />
            <code className="small">POST /api/stars/topup/submit-tx</code><br />
            <code className="small">GET /api/stars/topup/history</code><br />
            <code className="small">POST /api/stars/topup/retry</code>
          </div>
        </div>
        <div className="mt-3 row" style={{ gap: 8 }}>
          <a className="btn" href="/me">Account</a>
          <a className="btn" href="/">Home</a>
        </div>
      </div>
    </main>
  );
}
