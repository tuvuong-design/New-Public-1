import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { normalizeSensitiveMode } from "@/lib/sensitive";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!uid) return new Response("UNAUTHORIZED", { status: 401 });

  const form = await req.formData();
  // Backward compatible: some older UI used `mode`.
  const raw = String(form.get("sensitiveMode") ?? form.get("mode") ?? "").toUpperCase();
  const sensitiveMode = normalizeSensitiveMode(raw);

  await prisma.user.update({ where: { id: uid }, data: { sensitiveMode } });

  redirect(`/u/${uid}#sensitive`);
}
