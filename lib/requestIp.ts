export function getClientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for") ?? "";
  const parts = xf.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length) return parts[0];
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr;
  return "0.0.0.0";
}
