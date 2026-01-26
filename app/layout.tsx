import type { Metadata } from "next";
import "./globals.css";
import { env, flags, isConfiguredEnv } from "@/lib/env";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import GlobalBannerAds from "@/components/ads/GlobalBannerAds";
import PwaRegister from "@/components/pwa/PwaRegister";

export async function generateMetadata(): Promise<Metadata> {
  if (!isConfiguredEnv()) {
    return {
      title: "Install • VideoShare",
      description: "Thiết lập hệ thống lần đầu",
      icons: [{ rel: "icon", url: "/icon.svg" }],
    };
  }

  const { getSiteConfig } = await import("@/lib/siteConfig");
  const cfg = await getSiteConfig();

  const base = env.SITE_URL ? new URL(env.SITE_URL) : undefined;

  return {
    title: cfg.siteName,
    description: cfg.defaultDescription,
    manifest: "/manifest.json",
    icons: [{ rel: "icon", url: "/icon.svg" }],
    verification: cfg.googleVerification ? { google: cfg.googleVerification } : undefined,
    metadataBase: base,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isConfiguredEnv();

  if (!configured) {
    return (
      <html lang="vi">
        <body>
          <div className="container py-6">
            <div className="card mb-4">
              <div className="text-lg font-extrabold">VideoShare</div>
              <div className="small muted mt-1">
                Hệ thống chưa cấu hình môi trường — hãy chạy Install Wizard.
              </div>
            </div>
            {children}
          </div>
        </body>
      </html>
    );
  }

  const { getSiteConfig } = await import("@/lib/siteConfig");
  const OneSignalInit = (await import("@/components/push/OneSignalInit")).default;
  const cfg = await getSiteConfig();

  return (
    <html lang="vi">
      <body>
        {flags.oneSignal ? (
          <OneSignalInit
            appId={cfg.oneSignalAppId || ""}
            safariWebId={cfg.oneSignalSafariWebId || ""}
          />
        ) : null}

        <PwaRegister />

        <div className="min-h-screen bg-zinc-50">
          {/* Header */}
          <SiteHeader />
          <GlobalBannerAds scope="GLOBAL_TOP" />

          {/* Page content */}
          <main className="container py-6">{children}</main>

          {/* Footer */}
          <GlobalBannerAds scope="GLOBAL_BOTTOM" />
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
