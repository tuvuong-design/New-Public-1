import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { suggestTagsFromText } from "@/lib/seo/tagsSuggest";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const uid = (session?.user as any)?.id as string | undefined;
    if (!uid) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const v = await prisma.video.findUnique({ where: { id: params.id }, select: { id: true, authorId: true, title: true, description: true } });
    if (!v) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (v.authorId !== uid && !isAdmin(session)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const suggestions = suggestTagsFromText({ title: v.title, description: v.description }, 12);
    return NextResponse.json({ videoId: v.id, suggestions });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "ERROR" }, { status: 500 });
  }
}
