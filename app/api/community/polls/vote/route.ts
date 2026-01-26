import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  postId: z.string().min(1),
  optionId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await req.json());

  // Ensure option belongs to post
  const option = await prisma.communityPollOption.findUnique({
    where: { id: body.optionId },
    select: { id: true, postId: true },
  });
  if (!option || option.postId !== body.postId) {
    return Response.json({ error: "Invalid option" }, { status: 400 });
  }

  await prisma.communityPollVote.upsert({
    where: {
      postId_userId: {
        postId: body.postId,
        userId,
      },
    },
    update: { optionId: body.optionId },
    create: {
      postId: body.postId,
      optionId: body.optionId,
      userId,
    },
  });

  return Response.json({ ok: true });
}
