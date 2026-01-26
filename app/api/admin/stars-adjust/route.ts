import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const userId = String(form.get("userId") ?? "");
  const delta = Number(form.get("delta") ?? 0);
  const note = String(form.get("note") ?? "").trim();

  if (!userId) return new Response("userId required", { status: 400 });
  if (!Number.isFinite(delta) || delta === 0) return new Response("delta invalid", { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { starBalance: { increment: delta } } });
    await tx.starTransaction.create({
      data: {
        userId,
        delta,
        stars: Math.abs(delta),
        quantity: 1,
        type: delta > 0 ? "ADMIN_GRANT" : "ADMIN_DEDUCT",
        note: note || (delta > 0 ? "Admin grant stars" : "Admin deduct stars"),
      },
    });
  });

  redirect("/admin/stars");
}
