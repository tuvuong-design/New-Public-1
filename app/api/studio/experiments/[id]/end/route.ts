import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const exp = await prisma.videoExperiment.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, video: { select: { id: true, authorId: true } } },
  });
  if (!exp) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (exp.video.authorId !== userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  await prisma.videoExperiment.update({
    where: { id: exp.id },
    data: { status: "ENDED", endedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
