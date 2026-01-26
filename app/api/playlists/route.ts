import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const playlists = await prisma.playlist.findMany({
    where: { ownerId: uid },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { items: true } },
      coverKey: true,
      isSeries: true,
      seriesSlug: true,
    },
    take: 100,
  });

  return Response.json({ playlists }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as any;
  const title = String(body?.title ?? "").trim();
  const description = body?.description ? String(body.description).slice(0, 2000) : null;
  const visibilityRaw = String(body?.visibility ?? "PRIVATE").toUpperCase();
  const visibility = (visibilityRaw === "PUBLIC" || visibilityRaw === "UNLISTED" || visibilityRaw === "PRIVATE")
    ? (visibilityRaw as any)
    : ("PRIVATE" as any);

  if (!title) return Response.json({ error: "title required" }, { status: 400 });

  const playlist = await prisma.playlist.create({
    data: {
      ownerId: uid,
      title,
      description,
      visibility,
    },
    select: { id: true, title: true, description: true, visibility: true, createdAt: true, updatedAt: true },
  });

  return Response.json({ playlist }, { status: 201 });
}
