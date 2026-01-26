import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";

const chapterSchema = z.object({
  startSec: z.coerce.number().int().min(0).max(60 * 60 * 24),
  title: z.string().trim().min(1).max(120),
});

const bodySchema = z.object({
  chapters: z.array(chapterSchema).max(200).default([]),
});

async function requireOwner(videoId: string, userId: string, isAdmin: boolean) {
  const v = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true, authorId: true } });
  if (!v) return { ok: false as const, status: 404, message: "VIDEO_NOT_FOUND" };
  if (!isAdmin && v.authorId !== userId) return { ok: false as const, status: 403, message: "FORBIDDEN" };
  return { ok: true as const, video: v };
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const gate = await requireOwner(ctx.params.id, userId, Boolean(isAdmin));
  if (!gate.ok) return new Response(gate.message, { status: gate.status });

  const chapters = await prisma.videoChapter.findMany({
    where: { videoId: ctx.params.id },
    orderBy: { startSec: "asc" },
    select: { id: true, startSec: true, title: true },
  });

  return Response.json({ ok: true, chapters });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const isAdmin = session?.user?.role === "ADMIN";
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const gate = await requireOwner(ctx.params.id, userId, Boolean(isAdmin));
  if (!gate.ok) return new Response(gate.message, { status: gate.status });

  const body = bodySchema.parse(await req.json().catch(() => ({})));
  const normalized = body.chapters
    .map((c) => ({ startSec: Math.max(0, Math.floor(c.startSec)), title: c.title.trim() }))
    .filter((c) => c.title.length > 0)
    .sort((a, b) => a.startSec - b.startSec);

  await prisma.$transaction(async (tx) => {
    await tx.videoChapter.deleteMany({ where: { videoId: ctx.params.id } });
    if (normalized.length) {
      await tx.videoChapter.createMany({
        data: normalized.map((c) => ({ videoId: ctx.params.id, startSec: c.startSec, title: c.title })),
      });
    }
  });

  const chapters = await prisma.videoChapter.findMany({
    where: { videoId: ctx.params.id },
    orderBy: { startSec: "asc" },
    select: { id: true, startSec: true, title: true },
  });

  return Response.json({ ok: true, chapters });
}
