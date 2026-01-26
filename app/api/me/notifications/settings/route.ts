import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const KNOWN = new Set([
  "COMMENT_REPLY",
  "VIDEO_LIKE",
  "VIDEO_COMMENT",
  "NEW_SUBSCRIBER",
  "STAR_GIFT",
  "CREATOR_TIP",
  "CREATOR_MEMBERSHIP",
  "WEEKLY_DIGEST",
]);

const postSchema = z.object({
  disabled: z.array(z.string()).max(50).default([]),
});

export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const row = await prisma.notificationSetting.findUnique({
    where: { userId },
    select: { disabledTypesCsv: true },
  });

  const disabled = (row?.disabledTypesCsv || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return Response.json({ ok: true, disabled });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const ct = req.headers.get("content-type") || "";
  let body: z.infer<typeof postSchema>;
  if (ct.includes("application/json")) body = postSchema.parse(await req.json());
  else {
    const form = await req.formData();
    const raw = String(form.get("disabled") || "");
    body = postSchema.parse({ disabled: raw ? raw.split(",") : [] });
  }

  const cleaned = Array.from(
    new Set(body.disabled.map((x) => String(x).trim()).filter((x) => x && KNOWN.has(x))),
  );

  await prisma.notificationSetting.upsert({
    where: { userId },
    create: { userId, disabledTypesCsv: cleaned.join(",") },
    update: { disabledTypesCsv: cleaned.join(",") },
  });

  return Response.json({ ok: true, disabled: cleaned });
}
