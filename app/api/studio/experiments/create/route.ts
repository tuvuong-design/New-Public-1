import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  videoId: z.string().min(1),
  titleB: z.string().min(1).nullable().optional(),
  thumbKeyB: z.string().min(1).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  let json: any;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const { videoId, titleB, thumbKeyB } = parsed.data;

  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true, authorId: true, title: true, thumbKey: true } });
  if (!video) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (video.authorId !== userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const existing = await prisma.videoExperiment.findFirst({ where: { videoId, status: "RUNNING" }, select: { id: true } });
  if (existing) return NextResponse.json({ ok: false, error: "ALREADY_RUNNING" }, { status: 400 });

  const now = new Date();

  const exp = await prisma.videoExperiment.create({
    data: {
      videoId,
      createdById: userId,
      status: "RUNNING",
      startedAt: now,
      variants: {
        create: [
          { name: "A", title: video.title, thumbKey: video.thumbKey ?? null, weight: 50 },
          { name: "B", title: titleB ?? null, thumbKey: thumbKeyB ?? null, weight: 50 },
        ],
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: exp.id });
}
