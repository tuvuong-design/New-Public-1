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
  const applyToAll = form.get("applyToAll") === "1";
  const ids = form.getAll("videoIds").map(String).filter(Boolean);

  const access = (form.get("access") || "").toString();
  const status = (form.get("status") || "").toString();
  const sensitiveRaw = (form.get("sensitive") || "").toString();
  const interactionsRaw = (form.get("interactionsLocked") || "").toString();

  if (!applyToAll && ids.length === 0) {
    redirect("/studio");
  }

  const data: any = {};
  const now = new Date();

  if (access) {
    data.access = access;
    if (access === "VIOLATOR_ONLY") {
      data.interactionsLocked = true;
    }
  }

  if (status) {
    data.status = status;
    if (status === "DELETED") {
      data.deletedAt = now;
      data.deletedById = userId;
    } else {
      // If restoring from soft-delete intentionally
      data.deletedAt = null;
      data.deletedById = null;
    }
  }

  if (sensitiveRaw === "true" || sensitiveRaw === "false") {
    data.isSensitive = sensitiveRaw === "true";
  }

  if (interactionsRaw === "true" || interactionsRaw === "false") {
    data.interactionsLocked = interactionsRaw === "true";
  }

  // No-op guard
  if (Object.keys(data).length === 0) {
    redirect("/studio");
  }

  await prisma.video.updateMany({
    where: {
      authorId: userId,
      ...(applyToAll ? {} : { id: { in: ids } }),
    },
    data,
  });

  redirect("/studio");
}
