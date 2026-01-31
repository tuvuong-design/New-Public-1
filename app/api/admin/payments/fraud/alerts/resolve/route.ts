import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ id: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const adminId = (session!.user as any).id as string;

  const cur = await prisma.fraudAlert.findUnique({ where: { id: parsed.data.id } });
  if (!cur) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (cur.status === "RESOLVED") return Response.json({ ok: true, status: cur.status });

  const updated = await prisma.fraudAlert.update({
    where: { id: cur.id },
    data: { status: "RESOLVED", resolvedById: adminId, resolvedAt: new Date() },
  });

  return Response.json({ ok: true, item: updated });
}
