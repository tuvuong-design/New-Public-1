import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const op = String(form.get("op") ?? "create");
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const icon = String(form.get("icon") ?? "").trim() || null;
  const starsCost = Math.max(1, Math.min(9999, Number(form.get("starsCost") ?? 1)));
  const sort = Math.max(0, Math.min(9999, Number(form.get("sort") ?? 0)));
  const active = String(form.get("active") ?? "on") === "on";

  if (op === "delete") {
    if (!id) return new Response("id required", { status: 400 });
    await prisma.gift.delete({ where: { id } }).catch(() => null);
    redirect("/admin/gifts");
  }

  if (!name) return new Response("name required", { status: 400 });

  if (op === "update") {
    if (!id) return new Response("id required", { status: 400 });
    await prisma.gift.update({ where: { id }, data: { name, icon, starsCost, sort, active } });
    redirect("/admin/gifts");
  }

  // create
  await prisma.gift.create({ data: { name, icon, starsCost, sort, active } });
  redirect("/admin/gifts");
}
