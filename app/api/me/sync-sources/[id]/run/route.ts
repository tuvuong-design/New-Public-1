import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queues } from "@/lib/queues";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const id = String(params.id ?? "");
  const src = await prisma.apiSource.findFirst({ where: { id, ownerId: userId } });
  if (!src) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  await queues.syncApiSource.add("sync", { apiSourceId: src.id }, { removeOnComplete: true, removeOnFail: 100 });
  return Response.json({ ok: true });
}
