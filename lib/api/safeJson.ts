export function safeJson(v: any) {
  try { return JSON.stringify(v); } catch { return String(v); }
}
