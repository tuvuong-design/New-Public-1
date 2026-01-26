"use client";

import { useEffect } from "react";

/**
 * Task 10 (PWA): register service worker for offline shell + lightweight caching.
 * This must be a client component.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Avoid registering in development if SW is not desired.
    // Still allow if user explicitly wants to test PWA.
    const isDev = process.env.NODE_ENV !== "production";
    const allowInDev = window.localStorage.getItem("videoshare:sw:dev") === "1";
    if (isDev && !allowInDev) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        // noop
      })
      .catch(() => {
        // noop
      });
  }, []);

  return null;
}
