export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-xl space-y-3">
      <div className="card">
        <div className="text-lg font-extrabold">Bạn đang offline</div>
        <div className="small muted mt-1">
          Kết nối mạng đã bị ngắt. Bạn vẫn có thể mở các trang đã được cache trước đó.
        </div>
        <div className="mt-3 grid gap-2">
          <a className="btn" href="/feed">Về Feed</a>
          <a className="btn" href="/upload">Upload (hàng đợi offline)</a>
        </div>
      </div>
      <div className="card small muted">
        Tip: nếu bạn muốn test PWA trong môi trường dev, mở DevTools Console và chạy:
        <pre className="mt-2 rounded-lg bg-zinc-50 p-2">localStorage.setItem("videoshare:sw:dev","1"); location.reload();</pre>
      </div>
    </main>
  );
}
