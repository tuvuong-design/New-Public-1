import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { shouldRedirectToInstall } from "@/lib/install/guard";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  if (shouldRedirectToInstall(url.pathname)) {
    url.pathname = "/install";
    return NextResponse.redirect(url);
  }

  // Stable anonymous viewer id for analytics & A/B experiments.
  const hasVsid = Boolean(req.cookies.get("vsid")?.value);
  const res = NextResponse.next();
  if (!hasVsid) {
    const vsid = crypto.randomUUID();
    // 400 days (approx). Use Lax so it works across internal navigation.
    res.cookies.set("vsid", vsid, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 400 });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
