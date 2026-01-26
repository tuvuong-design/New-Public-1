import { env } from "@/lib/env";

/**
 * Resolve a media reference to an absolute URL.
 *
 * - If value is already an absolute http(s) URL, return as-is.
 * - Otherwise treat it as an R2 key and prefix with R2_PUBLIC_BASE_URL.
 */
export function resolveMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  const base = env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  return `${base}/${v}`;
}

export function isAbsoluteHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}