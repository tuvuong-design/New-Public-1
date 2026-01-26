import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { releaseMaturedHolds } from "@/lib/stars/holds";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  // @ts-expect-error custom field
  const userId = session?.user?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  // Opportunistically release matured holds so balance reflects unlocked proceeds.
  await releaseMaturedHolds(userId).catch(() => null);

  const u = await prisma.user.findUnique({ where: { id: userId }, select: { starBalance: true } });
  return Response.json({ ok: true, starBalance: u?.starBalance ?? 0 });
}
