import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { refundDepositStars } from "@/lib/payments/credit";
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
    const out = await refundDepositStars(parsed.data.depositId, parsed.data.reason || "ADMIN_REFUND");
    return Response.json({ ok: true, out });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "FAILED" }, { status: 500 });
  }
}
