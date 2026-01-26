import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const ct = req.headers.get("content-type") || "";
  let id: string | null = null;
  let all = false;

  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as any;
    id = body?.id ? String(body.id) : null;
    all = Boolean(body?.all);
  } else {
    const form = await req.formData();
    id = form.get("id") ? String(form.get("id")) : null;
    all = String(form.get("all") || "") === "1";
  }

  if (all) {
    await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  } else if (id) {
    await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  } else {
    return new Response("id or all required", { status: 400 });
  }

  if (!ct.includes("application/json")) redirect("/notifications");
  return Response.json({ ok: true });
}
