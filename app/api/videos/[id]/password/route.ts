import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hashVideoPassword } from "@/lib/videoPassword";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const v = await prisma.video.findUnique({ where: { id: params.id }, select: { id: true, authorId: true } });
  if (!v) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const viewerId = (session.user as any).id as string | undefined;
  const isAdmin = session.user.role === "ADMIN";
  const isOwner = viewerId && viewerId === v.authorId;
  if (!isAdmin && !isOwner) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const form = await req.formData();
  const password = String(form.get("password") ?? "").trim();
  const hint = String(form.get("hint") ?? "").trim();

  if (!password) {
    await prisma.video.update({
      where: { id: v.id },
      data: { accessPasswordHash: null, accessPasswordHint: hint || null },
    });
    const referer = req.headers.get("referer");
    const dest = referer ? new URL(referer) : new URL(`/admin/videos/${v.id}?pw=cleared`, req.url);
    return NextResponse.redirect(dest);
  }

  const hash = await hashVideoPassword(password);
  await prisma.video.update({
    where: { id: v.id },
    data: { accessPasswordHash: hash, accessPasswordHint: hint || null },
  });

  // Redirect back (admin detail by default; owner UI can override via referer).
  const referer = req.headers.get("referer");
  const dest = referer ? new URL(referer) : new URL(`/admin/videos/${v.id}`, req.url);
  return NextResponse.redirect(dest);
}
