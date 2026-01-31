import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  videoId: z.string().min(1),
  redirect: z.string().optional(),
});

function isFormRequest(req: Request) {
  const ct = req.headers.get("content-type") || "";
  return ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
}

async function readBody(req: Request) {
  if (isFormRequest(req)) {
    const fd = await req.formData();
    return {
      videoId: String(fd.get("videoId") || ""),
      redirect: fd.get("redirect") ? String(fd.get("redirect")) : undefined,
    };
  }
  return await req.json();
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  let body: any;
  try {
    body = await readBody(req);
  } catch {
    return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const userId = (session.user as any).id as string;
  const { videoId } = parsed.data;

  const existing = await prisma.watchLaterItem.findUnique({ where: { userId_videoId: { userId, videoId } } });
  let active = false;
  if (existing) {
    await prisma.watchLaterItem.delete({ where: { id: existing.id } });
    active = false;
  } else {
    // Ensure video exists and is published
    const v = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true, status: true } });
    if (!v || (v as any).status !== "PUBLISHED") {
      return Response.json({ ok: false, error: "VIDEO_NOT_FOUND" }, { status: 404 });
    }
    await prisma.watchLaterItem.create({ data: { userId, videoId } });
    active = true;
  }

  if (isFormRequest(req)) {
    const base = new URL(req.url);
    const target = parsed.data.redirect || req.headers.get("referer") || "/watch-later";
    const url = new URL(target, base);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, active });
}
