import { queues } from "@/lib/queues";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const src = await prisma.apiSource.findUnique({ where: { id } });
  if (!src) return new Response("not found", { status: 404 });

  await queues.syncApiSource.add("sync", { apiSourceId: id }, { removeOnComplete: true, removeOnFail: 100 });
  redirect("/admin/api-sources");
}
