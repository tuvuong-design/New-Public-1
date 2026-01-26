import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(["OPEN", "REVIEWED", "RESOLVED", "REJECTED"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  let body: z.infer<typeof schema>;
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    body = schema.parse(await req.json());
  } else {
    const form = await req.formData();
    body = schema.parse({
      id: String(form.get("id") || ""),
      status: String(form.get("status") || ""),
    });
  }
  const reviewerId = (session?.user as any)?.id as string | undefined;

  await prisma.videoReport.update({
    where: { id: body.id },
    data: { status: body.status, reviewerId: reviewerId ?? null, reviewedAt: new Date() },
  });

  // If this is a browser form submit, redirect back.
  if (!ct.includes("application/json")) {
    const back = req.headers.get("referer") || "/admin/reports";
    return Response.redirect(back, 303);
  }

  return Response.json({ ok: true });
}
