import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({ id: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!uid) return new Response("UNAUTHORIZED", { status: 401 });

  const body = schema.parse(await req.json());

  const order = await prisma.boostOrder.findUnique({ where: { id: body.id }, select: { userId: true } });
  if (!order || order.userId !== uid) return new Response("NOT_FOUND", { status: 404 });

  await prisma.boostOrder.update({ where: { id: body.id }, data: { status: "CANCELED", endAt: new Date() } });
  return Response.json({ ok: true });
}
