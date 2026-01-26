import { canAccessInstallWizard } from "@/lib/install/guard";
import InstallWizard from "./ui/InstallWizard";

export const dynamic = "force-dynamic";

export default async function InstallPage() {
  const ok = canAccessInstallWizard();

  if (!ok) {
    return (
      <main>
        <h1>Install Wizard</h1>
        <div className="card">
          Hệ thống đã được cấu hình. Nếu muốn mở lại wizard, set <code>INSTALL_WIZARD_ENABLED=true</code> rồi restart.
        </div>
        <p className="small muted">Bạn có thể xoá thư mục <code>app/install</code> và <code>app/api/install</code> nếu không dùng nữa.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Install Wizard</h1>
      <p className="muted small">
        Thiết lập DB / Redis / Cloudflare R2 ngay trên web. Nếu server không có quyền ghi file, Wizard sẽ tạo nội dung <code>.env</code> để bạn copy-paste vào aaPanel.
      </p>

      <InstallWizard />
    </main>
  );
}
