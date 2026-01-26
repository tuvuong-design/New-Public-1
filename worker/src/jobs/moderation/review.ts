import { prisma } from "../../prisma";
import { env } from "../../env";

async function postDiscord(message: string) {
  if (!env.DISCORD_ALERT_WEBHOOK_URL) return;
  await fetch(env.DISCORD_ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: message }),
  }).catch(() => {});
}

// Moderation pipeline job (MVP): fan-out report info to operators.
// Actions remain manual in Admin UI.
export async function moderationReviewJob(data: { kind: "video" | "comment"; reportId: string }) {
  if (data.kind === "video") {
    const r = await prisma.videoReport.findUnique({
      where: { id: data.reportId },
      include: { video: { select: { id: true, title: true, authorId: true } } },
    });
    if (!r) return { ok: false, error: "NOT_FOUND" };
    await postDiscord(`🛡️ New video report\n- video: ${r.videoId}\n- reason: ${r.reason}\n- status: ${r.status}\n- createdAt: ${r.createdAt.toISOString()}\n- url: ${env.SITE_URL}/admin/reports`);
    return { ok: true };
  }

  // comment
  const cr = await prisma.commentReport.findUnique({ where: { id: data.reportId }, include: { comment: { select: { id: true, videoId: true } } } }).catch(() => null);
  if (cr) {
    await postDiscord(`🛡️ New comment report\n- comment: ${cr.commentId}\n- video: ${cr.comment?.videoId ?? ""}\n- status: ${cr.status}\n- url: ${env.SITE_URL}/admin/reports/comments`);
  }
  return { ok: true };
}
