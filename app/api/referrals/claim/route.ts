import { auth } from "@/lib/auth";
import { z } from "zod";
import { claimReferralCode } from "@/lib/referrals";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().min(1).max(24),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  try {
    const out = await claimReferralCode(userId, body.data.code);
    return Response.json({ ok: true, ...out });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "FAILED" }, { status: 400 });
  }
}
