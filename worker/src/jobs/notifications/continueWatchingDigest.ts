import { prisma } from "../../prisma";
import { env } from "../../env";

/**
 * Daily "continue watching" digest (in-app).
 *
 * - For each user: if they have unfinished progress in the last N days, and haven't
 *   received a digest today, create a notification with top items.
 * - Respects NotificationSetting.disabledTypesCsv.
 */
export async function continueWatchingDigestJob() {
  const now = new Date();

  const lookbackDays = env.NOTIFICATIONS_CONTINUE_WATCHING_LOOKBACK_DAYS;
  const lookback = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  // Users with any progress recently.
  const recent = await prisma.videoProgress.findMany({
    where: { updatedAt: { gte: lookback }, seconds: { gt: 10 } },
    select: { userId: true },
    distinct: ["userId"],
    take: env.NOTIFICATIONS_CONTINUE_WATCHING_MAX_USERS_PER_RUN,
  });

  if (recent.length === 0) return { ok: true, users: 0 };

  // Day boundary (server/local time is ok for digest; we just want "once per day" behavior)
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  let created = 0;

  for (const r of recent) {
    const userId = r.userId;

    // Skip if disabled
    const setting = await prisma.notificationSetting.findUnique({
      where: { userId },
      select: { disabledTypesCsv: true },
    });
    const disabled = (setting?.disabledTypesCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (disabled.includes("CONTINUE_WATCHING_DIGEST")) continue;

    // Skip if already created today
    const exists = await prisma.notification.findFirst({
      where: { userId, type: "CONTINUE_WATCHING_DIGEST", createdAt: { gte: startOfDay } },
      select: { id: true },
    });
    if (exists) continue;

    const items = await prisma.videoProgress.findMany({
      where: { userId, updatedAt: { gte: lookback }, seconds: { gt: 10 } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        seconds: true,
        updatedAt: true,
        video: {
          select: {
            id: true,
            title: true,
            durationSec: true,
            isPublished: true,
            isSensitive: true,
          },
        },
      },
    });

    const unfinished = items
      .filter((it) => it.video?.isPublished)
      .filter((it) => (it.video?.durationSec || 0) > 0)
      .filter((it) => it.seconds < (it.video!.durationSec - 15));

    if (unfinished.length === 0) continue;

    const top = unfinished.slice(0, env.NOTIFICATIONS_CONTINUE_WATCHING_MAX_ITEMS);
    const titles = top.map((it) => `• ${it.video?.title || "Video"}`).join("\n");

    await prisma.notification.create({
      data: {
        userId,
        type: "CONTINUE_WATCHING_DIGEST",
        title: "Tiếp tục xem?",
        body: `Bạn đang xem dở vài video:\n${titles}`,
        url: "/history",
        dataJson: JSON.stringify({
          videoIds: top.map((t) => t.video!.id),
          createdAt: now.toISOString(),
        }),
      },
    });

    created += 1;
  }

  return { ok: true, users: recent.length, created };
}
