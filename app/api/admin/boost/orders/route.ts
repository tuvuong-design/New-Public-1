import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELED", "EXPIRED"]),
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
    raw = {
      id: String(form.get("id") || ""),
      status: String(form.get("status") || ""),
    };
  }

  const body = schema.parse(raw);

  await prisma.boostOrder.update({
    where: { id: body.id },
    data: { status: body.status, endAt: body.status === "CANCELED" || body.status === "EXPIRED" ? new Date() : undefined },
  });

  if (!isJson) {
    const back = req.headers.get("referer") || "/admin/boost/orders";
    return Response.redirect(back, 303);
  }

  return Response.json({ ok: true });
}
