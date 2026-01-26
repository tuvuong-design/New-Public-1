import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const nftItemId = String(form.get("nftItemId") || "").trim();
  const clear = String(form.get("clear") || "") === "1";

  const back = req.headers.get("referer") || `/u/${userId}/nfts`;

  if (clear) {
    await prisma.user.update({ where: { id: userId }, data: { avatarNftItemId: null } });
    redirect(back);
  }

  if (!nftItemId) {
    return Response.json({ error: "Missing nftItemId" }, { status: 400 });
  }

  const item = await prisma.nftItem.findUnique({ where: { id: nftItemId }, select: { id: true, ownerId: true } });
  if (!item || item.ownerId !== userId) {
    return Response.json({ error: "Not your NFT" }, { status: 403 });
  }

  await prisma.user.update({ where: { id: userId }, data: { avatarNftItemId: nftItemId } });
  redirect(back);
}
