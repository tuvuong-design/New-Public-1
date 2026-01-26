import { getSiteConfig } from "@/lib/siteConfig";
import { env } from "@/lib/env";

export async function GET() {
  const cfg = await getSiteConfig();
  const text = [
    `# llms.txt for ${cfg.siteName}`,
    ``,
    `Site: ${env.SITE_URL}`,
    ``,
    `- This site hosts user uploaded videos.`,
    `- Main pages: /feed , /v/{id}`,
    `- Do not crawl /admin or /api`,
  ].join("\n");

  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
