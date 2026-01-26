import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WatchLaterPage() {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;

  if (!uid) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="card">
          <div className="text-lg font-extrabold">Watch Later</div>
          <div className="small muted mt-1">Vui lòng đăng nhập để xem danh sách xem sau.</div>
          <div className="mt-3">
            <a className="btn" href="/login">Login</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">Watch Later</div>
        <div className="small muted mt-1">
          Trang này là contract path (không được đổi). Tính năng “xem sau” sẽ được hoàn thiện theo task tiếp theo.
        </div>
        <div className="mt-3 row" style={{ gap: 8 }}>
          <a className="btn" href="/history">History</a>
          <a className="btn" href="/">Home</a>
        </div>
      </div>
    </main>
  );
}
