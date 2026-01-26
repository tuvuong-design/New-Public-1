import { env } from "@/lib/env";
export async function GET() {
  return new Response(env.INDEXNOW_KEY || "", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
