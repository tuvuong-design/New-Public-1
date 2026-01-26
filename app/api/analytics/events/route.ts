import { NextResponse } from "next/server";
import { z } from "zod";
import { queues } from "@/lib/queues";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { getRequestCountryIso2 } from "@/lib/analytics/country";
import { env } from "@/lib/env";

const eventSchema = z.object({
  type: z.enum(["PRESENCE", "EXPOSURE", "VIEW_START", "PROGRESS", "COMPLETE", "CARD_IMPRESSION", "CARD_CLICK"]),
  videoId: z.string().min(1),
  ts: z.number().int().optional(),
  positionSec: z.number().nonnegative().optional(),
  durationSec: z.number().nonnegative().optional(),
  deltaSec: z.number().nonnegative().optional(),
  watchPctBp: z.number().int().min(0).max(10000).optional(),
  experimentId: z.string().optional(),
  variantId: z.string().optional(),
  source: z.string().max(32).optional(),
  placement: z.string().max(32).optional(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(50),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const jar = cookies();
    const vsid = jar.get("vsid")?.value || "";
    if (!vsid) {
      // Client should have cookie via middleware; fail soft.
      return NextResponse.json({ ok: true, skipped: true });
    }

    const session = await auth();
    const userId = (session?.user as any)?.id as string | undefined;
    const country = getRequestCountryIso2();

    // Install Wizard mode: allow analytics endpoint without redis/queues.
    if (!env.REDIS_URL) return NextResponse.json({ ok: true, skipped: true });

    await queues.analytics.add(
      "analytics_ingest_events",
      {
        vsid,
        userId: userId ?? null,
        country,
        receivedAtMs: Date.now(),
        events: parsed.data.events,
      },
      { removeOnComplete: true, removeOnFail: 500 },
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "ERROR" }, { status: 500 });
  }
}
