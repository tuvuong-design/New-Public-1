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

async function getSystemActorUserId() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true }, orderBy: { createdAt: "asc" } }).catch(() => null);
  return admin?.id ?? null;
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Moderation escalation scan:
 * - Auto mute/ban by strike thresholds
 * - Auto mute by report velocity (OPEN reports in recent window)
 *
 * This job is designed to be triggered from `payments.alert_cron` (repeatable).
 */
export async function moderationEscalationScanJob() {
  if (env.MODERATION_ESCALATION_ENABLED !== "true") return { skipped: true, reason: "disabled" };

  const actorUserId = await getSystemActorUserId();
  if (!actorUserId) return { skipped: true, reason: "no_admin_actor" };

  const now = new Date();
  const muteAt = Number(env.MODERATION_AUTO_MUTE_STRIKES || 3);
  const banAt = Number(env.MODERATION_AUTO_BAN_STRIKES || 5);
  const windowMin = Number(env.MODERATION_REPORT_VELOCITY_WINDOW_MIN || 30);
  const velocityThreshold = Number(env.MODERATION_REPORT_VELOCITY_THRESHOLD || 5);

  let mutedByStrike = 0;
  let bannedByStrike = 0;
  let mutedByVelocity = 0;

  // 1) Strike-based escalation
  if (banAt > 0) {
    const banTargets = await prisma.user.findMany({
      where: { role: { not: "ADMIN" }, bannedAt: null, strikeCount: { gte: banAt } },
      select: { id: true, strikeCount: true },
      take: 200,
    });

    for (const u of banTargets) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: u.id }, data: { bannedAt: now, banReason: `AUTO_BAN_STRIKES_${banAt}` } });
        await tx.moderationAction.create({
          data: {
            type: "BAN_USER",
            actorUserId,
            targetUserId: u.id,
            reason: `AUTO: strikeCount=${u.strikeCount}>=${banAt}`,
          },
        });
      }).catch(() => {});
      bannedByStrike++;
    }
  }

  if (muteAt > 0) {
    const muteTargets = await prisma.user.findMany({
      where: {
        role: { not: "ADMIN" },
        bannedAt: null,
        strikeCount: { gte: muteAt },
        OR: [{ mutedUntil: null }, { mutedUntil: { lt: now } }],
      },
      select: { id: true, strikeCount: true },
      take: 500,
    });

    for (const u of muteTargets) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: u.id }, data: { mutedUntil: addDays(now, 7) } });
        await tx.moderationAction.create({
          data: {
            type: "MUTE_USER_7D",
            actorUserId,
            targetUserId: u.id,
            reason: `AUTO: strikeCount=${u.strikeCount}>=${muteAt}`,
          },
        });
      }).catch(() => {});
      mutedByStrike++;
    }
  }

  // 2) Report velocity escalation (OPEN reports within a time window)
  const from = new Date(now.getTime() - windowMin * 60 * 1000);

  const [videoReports, commentReports] = await Promise.all([
    prisma.videoReport.findMany({
      where: { createdAt: { gte: from }, status: "OPEN" },
      select: { videoId: true },
      take: 5000,
    }),
    prisma.commentReport.findMany({
      where: { createdAt: { gte: from }, status: "OPEN" },
      select: { commentId: true },
      take: 5000,
    }),
  ]);

  const videoIds = Array.from(new Set(videoReports.map((r) => r.videoId)));
  const commentIds = Array.from(new Set(commentReports.map((r) => r.commentId)));

  const [videos, comments] = await Promise.all([
    videoIds.length
      ? prisma.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, authorId: true } })
      : Promise.resolve([] as Array<{ id: string; authorId: string }>),
    commentIds.length
      ? prisma.comment.findMany({ where: { id: { in: commentIds } }, select: { id: true, userId: true } })
      : Promise.resolve([] as Array<{ id: string; userId: string }>),
  ]);

  const videoToAuthor = new Map(videos.map((v) => [v.id, v.authorId]));
  const commentToAuthor = new Map(comments.map((c) => [c.id, c.userId]));

  const counts = new Map<string, number>();
  for (const r of videoReports) {
    const uid = videoToAuthor.get(r.videoId);
    if (!uid) continue;
    counts.set(uid, (counts.get(uid) ?? 0) + 1);
  }
  for (const r of commentReports) {
    const uid = commentToAuthor.get(r.commentId);
    if (!uid) continue;
    counts.set(uid, (counts.get(uid) ?? 0) + 1);
  }

  const velocityTargets = Array.from(counts.entries())
    .filter(([uid, c]) => c >= velocityThreshold && uid !== actorUserId)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  for (const [uid, c] of velocityTargets) {
    // Best-effort skip if already muted/banned
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, role: true, bannedAt: true, mutedUntil: true } }).catch(() => null);
    if (!u || u.role === "ADMIN" || u.bannedAt) continue;
    if (u.mutedUntil && new Date(u.mutedUntil).getTime() > now.getTime()) continue;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: uid }, data: { mutedUntil: addDays(now, 7) } });
      await tx.moderationAction.create({
        data: {
          type: "MUTE_USER_7D",
          actorUserId,
          targetUserId: uid,
          reason: `AUTO: report_velocity=${c}/${windowMin}m>=${velocityThreshold}`,
        },
      });
    }).catch(() => {});
    mutedByVelocity++;
  }

  if (bannedByStrike || mutedByStrike || mutedByVelocity) {
    const lines = [
      bannedByStrike ? `- auto ban (strike): ${bannedByStrike}` : null,
      mutedByStrike ? `- auto mute (strike): ${mutedByStrike}` : null,
      mutedByVelocity ? `- auto mute (velocity): ${mutedByVelocity}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    await postDiscord(`🛡️ *Moderation escalation applied*\nWindow: ${windowMin}m, threshold: ${velocityThreshold}\n${lines}`);
  }

  return {
    ok: true,
    mutedByStrike,
    bannedByStrike,
    mutedByVelocity,
    windowMin,
    velocityThreshold,
    muteAt,
    banAt,
  };
}
