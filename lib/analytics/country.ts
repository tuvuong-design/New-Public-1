import { headers } from "next/headers";

export function getRequestCountryIso2() {
  const h = headers();
  const raw =
    h.get("cf-ipcountry") ||
    h.get("x-vercel-ip-country") ||
    h.get("x-country") ||
    h.get("x-geo-country") ||
    "";

  const c = raw.trim().toUpperCase();
  if (!c || c.length !== 2) return "ZZ";
  return c;
}
