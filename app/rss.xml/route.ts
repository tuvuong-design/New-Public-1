import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function baseUrl(req: Request) {
  try {
    return env.SITE_URL ? new URL(env.SITE_URL) : new URL(req.url);
  } catch {
    return new URL(req.url);
  }
}

export async function GET(req: Request) {
  const base = baseUrl(req);
  const site = await prisma.siteConfig.findFirst({ where: { id: 1 }, select: { siteName: true, defaultDescription: true } });

  const videos = await prisma.video.findMany({
    where: { status: "PUBLISHED", access: "PUBLIC", isSensitive: false },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, username: true } },
    },
  });

  const channelTitle = site?.siteName ?? "VideoShare";
  const channelDesc = site?.defaultDescription ?? "VideoShare";

  const selfLink = new URL("/rss.xml", base).toString();
  const homeLink = base.toString().replace(/\/$/, "");

  const itemsXml = videos
    .map((v) => {
      const link = new URL(`/v/${v.id}`, base).toString();
      const authorName = v.author?.name ?? v.author?.username ?? "";
      const desc = (v.description ?? "").slice(0, 5000);
      return [
        "<item>",
        `<title>${escapeXml(v.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink=\"true\">${escapeXml(link)}</guid>`,
        `<pubDate>${new Date(v.createdAt).toUTCString()}</pubDate>`,
        authorName ? `<author>${escapeXml(authorName)}</author>` : "",
        desc ? `<description><![CDATA[${desc}]]></description>` : "",
        "</item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(homeLink)}</link>
    <description>${escapeXml(channelDesc)}</description>
    <atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}
