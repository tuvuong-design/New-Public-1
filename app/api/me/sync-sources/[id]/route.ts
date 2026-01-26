import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({ enabled: z.boolean().optional(), name: z.string().optional() });

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const id = String(params.id ?? "");
  const src = await prisma.apiSource.findFirst({ where: { id, ownerId: userId }, select: { id: true } });
  if (!src) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  await prisma.apiSource.delete({ where: { id: src.id } });
  return Response.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const id = String(params.id ?? "");
  const src = await prisma.apiSource.findFirst({ where: { id, ownerId: userId }, select: { id: true } });
  if (!src) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  await prisma.apiSource.update({
    where: { id: src.id },
    data: {
      ...(parsed.data.enabled === undefined ? {} : { enabled: parsed.data.enabled }),
      ...(parsed.data.name ? { name: parsed.data.name.slice(0, 120) } : {}),
    },
  });

  return Response.json({ ok: true });
}
