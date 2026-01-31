import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const upsertSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1).max(64),
  kind: z.enum(["PERCENT", "FIXED"]),
  value: z.number().int().min(1),
  appliesTo: z.enum(["ANY", "TOPUP", "SEASON_PASS"]).optional(),
  active: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxRedemptionsTotal: z.number().int().nonnegative().optional().nullable(),
  maxRedemptionsPerUser: z.number().int().nonnegative().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function GET() {
  const session = await auth();
  requireAdmin(session);
  const items = await prisma.coupon.findMany({ orderBy: { updatedAt: "desc" }, take: 500 });
  return Response.json({ ok: true, coupons: items });
}

export async function POST(req: Request) {
  const session = await auth();
  requireAdmin(session);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const data = parsed.data;
  const code = data.code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
    return Response.json({ ok: false, error: "INVALID_CODE_FORMAT" }, { status: 400 });
  }

  const startsAt = data.startsAt ? new Date(data.startsAt) : null;
  const endsAt = data.endsAt ? new Date(data.endsAt) : null;
  if (startsAt && endsAt && startsAt > endsAt) {
    return Response.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  const coupon = await prisma.coupon.upsert({
    where: data.id ? { id: data.id } : { code },
    create: {
      code,
      kind: data.kind,
      value: data.value,
      appliesTo: data.appliesTo ?? "ANY",
      active: data.active ?? true,
      startsAt,
      endsAt,
      maxRedemptionsTotal: data.maxRedemptionsTotal ?? null,
      maxRedemptionsPerUser: data.maxRedemptionsPerUser ?? null,
      note: data.note ?? null,
    },
    update: {
      code,
      kind: data.kind,
      value: data.value,
      appliesTo: data.appliesTo ?? "ANY",
      active: data.active ?? true,
      startsAt,
      endsAt,
      maxRedemptionsTotal: data.maxRedemptionsTotal ?? null,
      maxRedemptionsPerUser: data.maxRedemptionsPerUser ?? null,
      note: data.note ?? null,
    },
  });

  return Response.json({ ok: true, coupon });
}
