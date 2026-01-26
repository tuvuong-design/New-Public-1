import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  const session = await auth();
  const actorUserId = (session?.user as any)?.id as string | undefined;
  if (!isAdmin(session) || !actorUserId) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const action = String(form.get("action") ?? "").trim();
  const videoId = form.get("videoId") ? String(form.get("videoId")) : null;
  const commentId = form.get("commentId") ? String(form.get("commentId")) : null;
  const targetUserId = form.get("targetUserId") ? String(form.get("targetUserId")) : null;
  const creatorId = form.get("creatorId") ? String(form.get("creatorId")) : null;
  const keywordsCsv = form.get("keywordsCsv") ? String(form.get("keywordsCsv")) : null;
  const reason = form.get("reason") ? String(form.get("reason")) : null;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    switch (action) {
      case "HIDE_VIDEO": {
        if (!videoId) throw new Error("videoId required");
        await tx.video.update({ where: { id: videoId }, data: { status: "HIDDEN" } });
        await tx.moderationAction.create({ data: { type: "HIDE_VIDEO", actorUserId, videoId, reason } });
        break;
      }
      case "UNHIDE_VIDEO": {
        if (!videoId) throw new Error("videoId required");
        await tx.video.update({ where: { id: videoId }, data: { status: "PUBLISHED" } });
        await tx.moderationAction.create({ data: { type: "UNHIDE_VIDEO", actorUserId, videoId, reason } });
        break;
      }
      case "HIDE_COMMENT": {
        if (!commentId) throw new Error("commentId required");
        await tx.comment.update({
          where: { id: commentId },
          data: { visibility: "HIDDEN", moderatedAt: now, moderatedById: actorUserId },
        });
        await tx.moderationAction.create({ data: { type: "HIDE_COMMENT", actorUserId, commentId, reason } });
        break;
      }
      case "UNHIDE_COMMENT": {
        if (!commentId) throw new Error("commentId required");
        await tx.comment.update({
          where: { id: commentId },
          data: { visibility: "VISIBLE", moderatedAt: now, moderatedById: actorUserId },
        });
        await tx.moderationAction.create({ data: { type: "UNHIDE_COMMENT", actorUserId, commentId, reason } });
        break;
      }
      case "STRIKE_USER": {
        if (!targetUserId) throw new Error("targetUserId required");
        await tx.user.update({
          where: { id: targetUserId },
          data: { strikeCount: { increment: 1 } },
        });
        await tx.moderationAction.create({ data: { type: "STRIKE_USER", actorUserId, targetUserId, reason } });
        break;
      }
      case "MUTE_USER_7D": {
        if (!targetUserId) throw new Error("targetUserId required");
        await tx.user.update({
          where: { id: targetUserId },
          data: { mutedUntil: addDays(now, 7) },
        });
        await tx.moderationAction.create({ data: { type: "MUTE_USER_7D", actorUserId, targetUserId, reason } });
        break;
      }
      case "UNMUTE_USER": {
        if (!targetUserId) throw new Error("targetUserId required");
        await tx.user.update({ where: { id: targetUserId }, data: { mutedUntil: null } });
        await tx.moderationAction.create({ data: { type: "UNMUTE_USER", actorUserId, targetUserId, reason } });
        break;
      }
      case "BAN_USER": {
        if (!targetUserId) throw new Error("targetUserId required");
        await tx.user.update({ where: { id: targetUserId }, data: { bannedAt: now, banReason: reason?.slice(0, 200) || "Banned" } });
        await tx.moderationAction.create({ data: { type: "BAN_USER", actorUserId, targetUserId, reason } });
        break;
      }
      case "UNBAN_USER": {
        if (!targetUserId) throw new Error("targetUserId required");
        await tx.user.update({ where: { id: targetUserId }, data: { bannedAt: null, banReason: null } });
        await tx.moderationAction.create({ data: { type: "UNBAN_USER", actorUserId, targetUserId, reason } });
        break;
      }
      case "UPDATE_KEYWORDS": {
        if (!creatorId) throw new Error("creatorId required");
        await tx.creatorModerationSetting.upsert({
          where: { creatorId },
          create: { creatorId, keywordsCsv: (keywordsCsv || "").trim() },
          update: { keywordsCsv: (keywordsCsv || "").trim() },
        });
        await tx.moderationAction.create({ data: { type: "UPDATE_KEYWORDS", actorUserId, targetUserId: creatorId, reason: (keywordsCsv || "").trim() } });
        break;
      }
      default:
        throw new Error("Unknown action");
    }
  });

  const ref = req.headers.get("referer");
  return new Response(null, {
    status: 303,
    headers: { Location: ref || "/admin/reports" },
  });
}
