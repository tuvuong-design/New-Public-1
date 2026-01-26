import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fd = await req.formData();
  const channelUserId = String(fd.get("channelUserId") || "");
  if (!channelUserId) return Response.json({ error: "Missing channelUserId" }, { status: 400 });
  if (channelUserId === userId) return Response.json({ error: "Cannot subscribe to self" }, { status: 400 });

  const existing = await prisma.subscription.findUnique({
    where: { subscriberId_channelUserId: { subscriberId: userId, channelUserId } },
  });

  if (existing) {
    await prisma.subscription.delete({ where: { id: existing.id } });
  } else {
    await prisma.subscription.create({
      data: { subscriberId: userId, channelUserId },
    });
  }

  const ref = req.headers.get("referer") || `/u/${channelUserId}`;
  redirect(ref);
}
