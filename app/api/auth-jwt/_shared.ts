import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const ACCESS_COOKIE = "vs_access";
export const REFRESH_COOKIE = "vs_refresh";

function cookieOpts(maxAge: number) {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd, // must be true when SameSite=None
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge,
  };
}

export function setAuthCookies(access: string, refresh: string) {
  const c = cookies();
  c.set(ACCESS_COOKIE, access, cookieOpts(60 * 15));
  c.set(REFRESH_COOKIE, refresh, cookieOpts(60 * 60 * 24 * 30));
}

export function clearAuthCookies() {
  const c = cookies();
  c.set(ACCESS_COOKIE, "", cookieOpts(0));
  c.set(REFRESH_COOKIE, "", cookieOpts(0));
}
