import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(20).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_QUERY" }, { status: 400 });

  const q = String(parsed.data.q ?? "").trim().slice(0, 80);
  const take = parsed.data.take ?? 10;
  if (!q) return Response.json({ ok: true, q, items: [] });

  const [tags, categories, channels] = await Promise.all([
    prisma.tag.findMany({ where: { OR: [{ name: { contains: q } }, { slug: { contains: q } }] }, take, select: { name: true, slug: true } }),
    prisma.category.findMany({ where: { OR: [{ name: { contains: q } }, { slug: { contains: q } }] }, take, select: { name: true, slug: true } }),
    prisma.channel.findMany({ where: { OR: [{ name: { contains: q } }, { slug: { contains: q } }] }, take, select: { name: true, slug: true } }),
  ]);

  const items = [
    ...tags.map((t) => ({ type: "tag" as const, label: `#${t.name}`, value: t.slug })),
    ...categories.map((c) => ({ type: "category" as const, label: c.name, value: c.slug })),
    ...channels.map((c) => ({ type: "channel" as const, label: c.name, value: c.slug })),
    { type: "query" as const, label: `Tìm "${q}"`, value: q },
  ].slice(0, take);

  return Response.json({ ok: true, q, items });
}
