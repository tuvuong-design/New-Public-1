import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const patchSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  starsPrice: z.coerce.number().int().min(1).max(1_000_000).optional(),
  durationDays: z.coerce.number().int().min(1).max(365).optional(),
  benefits: z.string().max(2000).optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const body = patchSchema.parse(await req.json());

  const plan = await prisma.creatorMembershipPlan.findUnique({ where: { id: ctx.params.id } });
  if (!plan || plan.userId !== userId) return new Response("NOT_FOUND", { status: 404 });

  const updated = await prisma.creatorMembershipPlan.update({
    where: { id: plan.id },
    data: {
      title: body.title ?? undefined,
      starsPrice: body.starsPrice ?? undefined,
      durationDays: body.durationDays ?? undefined,
      benefits: body.benefits === undefined ? undefined : body.benefits?.trim() || null,
      isActive: body.isActive ?? undefined,
    },
  });

  return Response.json({ ok: true, plan: updated });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const plan = await prisma.creatorMembershipPlan.findUnique({ where: { id: ctx.params.id } });
  if (!plan || plan.userId !== userId) return new Response("NOT_FOUND", { status: 404 });

  await prisma.creatorMembershipPlan.delete({ where: { id: plan.id } });
  return Response.json({ ok: true });
}
