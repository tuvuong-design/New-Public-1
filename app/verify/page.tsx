import VerifyPanel from "./ui/VerifyPanel";
import WorkerPingPanel from "./ui/WorkerPingPanel";

export const dynamic = "force-dynamic";

export default function VerifyPage() {
  return (
    <main>
      <h1>Verify</h1>
      <p className="muted small">
        Trang này dùng để kiểm tra hệ thống sau khi bạn đã cấu hình <code>.env</code> và restart.
      </p>
      <VerifyPanel />
      <div style={{ height: 12 }} />
      <WorkerPingPanel />
      <div className="card" style={{ marginTop: 12 }}>
        <b>Worker check</b>
        <div className="small muted" style={{ marginTop: 6 }}>
          Worker chạy process riêng. Hãy đảm bảo worker có <code>ffmpeg</code> + <code>ffprobe</code> và đang chạy lệnh{" "}
          <code>npm run worker</code> (prod) hoặc <code>npm run worker:dev</code> (dev).
        </div>
      </div>
    </main>
  );
}
