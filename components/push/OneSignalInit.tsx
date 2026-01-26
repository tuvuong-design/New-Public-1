"use client";

import { useEffect } from "react";

export default function OneSignalInit({
  enabled,
  appId,
  safariWebId,
}: {
  enabled: boolean;
  appId: string;
  safariWebId: string;
}) {
  useEffect(() => {
    if (!enabled || !appId) return;
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/OneSignalSDK.js";
    script.async = true;
    document.head.appendChild(script);

    (window as any).OneSignal = (window as any).OneSignal || [];
    (window as any).OneSignal.push(function () {
      (window as any).OneSignal.init({
        appId,
        safari_web_id: safariWebId || undefined,
        notifyButton: { enable: true },
      });
    });

    return () => {
      document.head.removeChild(script);
    };
  }, [enabled, appId, safariWebId]);

  return null;
}
