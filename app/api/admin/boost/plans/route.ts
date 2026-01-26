import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { z } from "zod";

export const runtime = "nodejs";

const PlanSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(80),
  type: z.enum(["DURATION", "TARGET_INTERACTIONS"]),
  durationDays: z.number().int().min(1).max(365).optional(),
  targetViews: z.number().int().min(1).optional(),
  targetLikes: z.number().int().min(1).optional(),
  targetShares: z.number().int().min(1).optional(),
  targetComments: z.number().int().min(1).optional(),
  priceStars: z.number().int().min(1).max(1_000_000),
  active: z.boolean().default(true),
  sort: z.number().int().min(-9999).max(9999).default(0),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const ct = req.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  let raw: any;
  if (isJson) {
    raw = await req.json();
  } else {
    const form = await req.formData();
    const maybeInt = (v: FormDataEntryValue | null) => {
      if (v === null || v === undefined) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    raw = {
      id: String(form.get("id") || "") || undefined,
      name: String(form.get("name") || ""),
      type: String(form.get("type") || "DURATION"),
      durationDays: maybeInt(form.get("durationDays")),
      targetViews: maybeInt(form.get("targetViews")),
      targetLikes: maybeInt(form.get("targetLikes")),
      targetShares: maybeInt(form.get("targetShares")),
      targetComments: maybeInt(form.get("targetComments")),
      priceStars: maybeInt(form.get("priceStars")),
      active: form.get("active") === "on",
      sort: maybeInt(form.get("sort")) ?? 0,
    };
  }

  const body = PlanSchema.parse(raw);

  const data: any = {
    name: body.name,
    type: body.type,
    durationDays: body.type === "DURATION" ? body.durationDays ?? 7 : null,
    targetViews: body.type === "TARGET_INTERACTIONS" ? body.targetViews ?? null : null,
    targetLikes: body.type === "TARGET_INTERACTIONS" ? body.targetLikes ?? null : null,
    targetShares: body.type === "TARGET_INTERACTIONS" ? body.targetShares ?? null : null,
    targetComments: body.type === "TARGET_INTERACTIONS" ? body.targetComments ?? null : null,
    priceStars: body.priceStars,
    active: body.active,
    sort: body.sort,
  };

  if (body.id) {
    await prisma.boostPlan.update({ where: { id: body.id }, data });
  } else {
    await prisma.boostPlan.create({ data });
  }

  if (!isJson) {
    const back = req.headers.get("referer") || "/admin/boost/plans";
    return Response.redirect(back, 303);
  }

  return Response.json({ ok: true });
}
