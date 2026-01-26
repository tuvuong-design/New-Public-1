import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { enqueueNftExportVerify } from "@/lib/nft/exportQueue";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData();
  const requestId = String(form.get("requestId") || "").trim();
  const txHash = String(form.get("txHash") || "").trim();
  const mintAddress = String(form.get("mintAddress") || "").trim();
  const back = String(form.get("back") || req.headers.get("referer") || "/nft/exports");

  if (!requestId) return Response.json({ error: "REQUEST_ID_REQUIRED" }, { status: 400 });
  if (!txHash) return Response.json({ error: "TX_HASH_REQUIRED" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    const r = await tx.nftExportRequest.findUnique({ where: { id: requestId } });
    if (!r) throw new Error("REQUEST_NOT_FOUND");
    if (r.userId !== userId) throw new Error("FORBIDDEN");
    if (r.status !== "READY") throw new Error("NOT_READY");

    let mintedRef = r.mintedRef;
    if (mintAddress && String(r.chain) === "SOLANA") {
      try {
        const j = JSON.parse(r.mintedRef || "{}") as any;
        mintedRef = JSON.stringify({ ...j, mintAddress });
      } catch {
        mintedRef = JSON.stringify({ mintedRef: r.mintedRef, mintAddress });
      }
    }

    await tx.nftExportRequest.update({ where: { id: r.id }, data: { txHash, mintedRef } });
    await tx.nftEventLog.create({
      data: {
        actorId: userId,
        action: "NFT_EXPORT_TX_SUBMITTED",
        dataJson: JSON.stringify({ exportRequestId: r.id, txHash, mintAddress: mintAddress || undefined }),
      },
    });
  });

  await enqueueNftExportVerify(requestId);

  redirect(back);
}
