import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const url = new URL(req.url);
  const takeRaw = Number(url.searchParams.get("take") ?? 50);
  const take = Math.min(200, Math.max(1, Number.isFinite(takeRaw) ? takeRaw : 50));

  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      url: true,
      isRead: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
    },
  });

  return Response.json({
    ok: true,
    notifications: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      actor: n.actor ? { id: n.actor.id, name: n.actor.name } : null,
    })),
  });
}
