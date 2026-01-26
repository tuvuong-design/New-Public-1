import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  type: z.enum(["TEXT", "IMAGE", "GIF", "POLL", "YOUTUBE", "LINK"]),
  text: z.string().max(5000).optional().default(""),
  mediaUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
  youtubeUrl: z.string().url().optional(),
  pollQuestion: z.string().max(200).optional(),
  pollOptions: z.array(z.string().min(1).max(80)).max(6).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const authorId = url.searchParams.get("authorId");
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take") || "20")));

  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;

  const posts = await prisma.communityPost.findMany({
    where: {
      ...(authorId ? { authorId } : {}),
      isDeleted: false,
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      author: { select: { id: true, name: true, image: true, membershipTier: true, membershipExpiresAt: true } },
      pollOptions: { orderBy: { sort: "asc" }, include: { _count: { select: { votes: true } } } },
      pollVotes: viewerId ? { where: { userId: viewerId }, select: { optionId: true } } : false,
    },
  });

  return Response.json({ posts });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = createSchema.parse(await req.json());

  // Basic validation by type
  if (body.type === "POLL") {
    if (!body.pollQuestion || !body.pollOptions || body.pollOptions.length < 2) {
      return Response.json({ error: "Poll needs a question and at least 2 options" }, { status: 400 });
    }
  }

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.communityPost.create({
      data: {
        authorId: userId,
        type: body.type,
        text: body.text || "",
        mediaUrl: body.mediaUrl,
        linkUrl: body.linkUrl,
        youtubeUrl: body.youtubeUrl,
        pollQuestion: body.pollQuestion,
      },
    });

    if (body.type === "POLL" && body.pollOptions) {
      await tx.communityPollOption.createMany({
        data: body.pollOptions.map((t, idx) => ({
          postId: created.id,
          sort: idx,
          text: t,
        })),
      });
    }

    return created;
  });

  return Response.json({ ok: true, postId: post.id });
}
