import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { creditDepositStars } from "@/lib/payments/credit";
import { createFraudAlert } from "@/lib/payments/fraud";
import { z } from "zod";

const schema = z.object({ depositId: z.string().min(1), reason: z.string().optional() });

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

  try {
    const out = await creditDepositStars(parsed.data.depositId, parsed.data.reason || "ADMIN_MANUAL_CREDIT");

const largeThreshold = Number(process.env.FRAUD_MANUAL_CREDIT_ALERT_STARS || 2000);
if ((out as any)?.ok && Number((out as any)?.stars || 0) >= largeThreshold) {
  await createFraudAlert({
    kind: "MANUAL_CREDIT_LARGE",
    severity: "HIGH",
    dedupeKey: `deposit:${parsed.data.depositId}`,
    depositId: parsed.data.depositId,
    title: "Large manual credit",
    message: `Admin manual credit credited ${(out as any)?.stars} stars (threshold=${largeThreshold}). reason=${parsed.data.reason || "ADMIN_MANUAL_CREDIT"}`,
    payload: { depositId: parsed.data.depositId, stars: (out as any)?.stars, reason: parsed.data.reason || "ADMIN_MANUAL_CREDIT" },
  }).catch(() => {});
}

return Response.json({ ok: true, out });

  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "FAILED" }, { status: 500 });
  }
}
