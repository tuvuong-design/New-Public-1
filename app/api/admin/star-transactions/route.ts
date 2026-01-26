import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const list = await prisma.starTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, email: true, name: true } },
      video: { select: { id: true, title: true } },
      gift: { select: { id: true, name: true, icon: true, starsCost: true } },
    },
  });

  return Response.json({ ok: true, list });
}
