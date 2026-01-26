import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const planSchema = z.object({
  title: z.string().min(1).max(80),
  starsPrice: z.coerce.number().int().min(1).max(1_000_000),
  durationDays: z.coerce.number().int().min(1).max(365).default(30),
  benefits: z.string().max(2000).optional(),
  isActive: z.coerce.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const plans = await prisma.creatorMembershipPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ ok: true, plans });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const ct = req.headers.get("content-type") || "";
  let body: z.infer<typeof planSchema>;
  if (ct.includes("application/json")) {
    body = planSchema.parse(await req.json());
  } else {
    const form = await req.formData();
    body = planSchema.parse({
      title: String(form.get("title") || ""),
      starsPrice: String(form.get("starsPrice") || ""),
      durationDays: String(form.get("durationDays") || "30"),
      benefits: String(form.get("benefits") || ""),
      isActive: String(form.get("isActive") || "true"),
    });
  }

  const plan = await prisma.creatorMembershipPlan.create({
    data: {
      userId,
      title: body.title,
      starsPrice: body.starsPrice,
      durationDays: body.durationDays,
      benefits: body.benefits?.trim() || null,
      isActive: body.isActive ?? true,
    },
  });

  return Response.json({ ok: true, plan });
}
