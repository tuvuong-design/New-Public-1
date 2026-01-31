import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const session = await auth();
  requireAdmin(session);
  const id = ctx.params.id;
  await prisma.coupon.delete({ where: { id } }).catch(() => null);
  return Response.json({ ok: true });
}