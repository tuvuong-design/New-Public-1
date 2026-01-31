export const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) headers.set("X-API-Key", apiKey);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include", // allows cookie-based auth if same-site or configured
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) throw Object.assign(new Error(data?.error?.message || "API Error"), { status: res.status, data });
  return data;
}
