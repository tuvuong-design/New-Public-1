import { env } from "../env";

export function resolveMediaUrlWorker(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `${env.R2_PUBLIC_BASE_URL}/${v}`;
}
