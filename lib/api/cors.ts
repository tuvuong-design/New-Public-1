import { NextResponse } from "next/server";

export function withCors(res: NextResponse, origin?: string, allowCredentials = true) {
  if (origin) res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (allowCredentials) res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
}
