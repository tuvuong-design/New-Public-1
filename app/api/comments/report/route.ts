import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queues } from "@/lib/queues";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  commentId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const reporterId = (session?.user as any)?.id as string | undefined;
  if (!reporterId) return new Response("UNAUTHORIZED", { status: 401 });

  const body = schema.parse(await req.json());

  const c = await prisma.comment.findUnique({
    where: { id: body.commentId },
    select: { id: true, userId: true },
  });
  if (!c) return new Response("NOT_FOUND", { status: 404 });
  if (c.userId === reporterId) return new Response("FORBIDDEN", { status: 403 });

  try {
    const created = await prisma.commentReport.create({
      data: {
        commentId: body.commentId,
        reporterId,
        reason: body.reason?.trim() || null,
      },
      select: { id: true },
    });

    queues.moderation.add(
      "review_report",
      { kind: "comment", reportId: created.id },
      { removeOnComplete: 1000, removeOnFail: 1000, jobId: `moderation:comment:${created.id}` },
    ).catch(() => {});
  } catch (e: any) {
    // Likely unique (commentId, reporterId)
  }

  return Response.json({ ok: true });
}
