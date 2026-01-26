import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { invalidateSimilarVideosCache } from "@/lib/videos/similarCache";
import { enqueueCdnPurgePaths } from "@/lib/cdn/purge";

export const runtime = "nodejs";

function slugifyTag(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/g, "")
    .replace(/-$/g, "")
    .slice(0, 60);
}

function parseTags(raw: string): Array<{ slug: string; name: string }> {
  const parts = String(raw || "")
    .split(/[\n,]/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: Array<{ slug: string; name: string }> = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const slug = slugifyTag(p);
    if (!slug) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, name: p.slice(0, 60) });
    if (out.length >= 20) break;
  }
  return out;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const videoId = String(form.get("videoId") || "");
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "");
  const categoryIdRaw = String(form.get("categoryId") || "").trim();
  const categoryId = categoryIdRaw.length ? categoryIdRaw : null;
  const isSensitive = form.get("isSensitive") === "on";
  const tagsRaw = String(form.get("tags") || "");
  const tags = parseTags(tagsRaw);

  if (!videoId) return new Response("Bad Request", { status: 400 });
  if (!title) return new Response("Title is required", { status: 400 });

  const v = await prisma.video.findUnique({ where: { id: videoId } });
  if (!v) return new Response("Not found", { status: 404 });

  const minted = await prisma.nftItem.findUnique({ where: { videoId }, select: { id: true } });
  if (minted) {
    // Requirement: after mint, lock title/tags to keep NFT metadata stable.
    if (title !== v.title) {
      return new Response("Cannot change title after mint", { status: 400 });
    }
    if (tagsRaw.trim().length > 0) {
      return new Response("Cannot change tags after mint", { status: 400 });
    }
  }

  // Update base fields (title/category/description)
  await prisma.video.update({
    where: { id: videoId },
    data: {
      title,
      description,
      categoryId,
      isSensitive,
    },
  });

  // Replace tags (not allowed after mint)
  if (!minted) {
    await prisma.videoTag.deleteMany({ where: { videoId } });
    if (tags.length) {
    const tagRows = await Promise.all(
      tags.map((t) =>
        prisma.tag.upsert({
          where: { slug: t.slug },
          update: { name: t.name },
          create: { slug: t.slug, name: t.name },
          select: { id: true },
        })
      )
    );

      await prisma.videoTag.createMany({
      data: tagRows.map((row) => ({ videoId, tagId: row.id })),
      skipDuplicates: true,
    });
    }
  }

  // Invalidate similar videos cache when title/category/tags change (requirement).
  // After mint, title/tags are locked, but category still may change.
  await invalidateSimilarVideosCache(videoId);

  // Purge watch page + homepage/search surfaces best-effort.
  enqueueCdnPurgePaths([`/v/${videoId}`, `/`, `/search`], "video_update_metadata").catch(() => {});

  const back = req.headers.get("referer") || `/admin/videos/${videoId}`;
  return Response.redirect(back, 303);
}
