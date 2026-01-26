import { prisma } from "../../prisma";

function startOfWeekLocal(d: Date, offsetMinutes: number) {
  // Convert to local time by offset, then compute Monday 00:00 local, convert back to UTC.
  const local = new Date(d.getTime() + offsetMinutes * 60 * 1000);
  const day = local.getUTCDay(); // 0..6 with UTC but we offset already
  // Want Monday as start (1). If Sunday (0) => go back 6.
  const diff = (day === 0 ? 6 : day - 1);
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - diff);
  return new Date(local.getTime() - offsetMinutes * 60 * 1000);
}

function isMondayMorningLocal(d: Date, offsetMinutes: number) {
  const local = new Date(d.getTime() + offsetMinutes * 60 * 1000);
  return local.getUTCDay() === 1 && local.getUTCHours() >= 7 && local.getUTCHours() <= 10;
}

export async function weeklyDigestJob() {
  const now = new Date();
  const offsetMinutes = 7 * 60; // Asia/Ho_Chi_Minh
  if (!isMondayMorningLocal(now, offsetMinutes)) {
    return { skipped: true, reason: "not monday morning local" };
  }

  const weekStart = startOfWeekLocal(now, offsetMinutes);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Disabled users
  const disabled = await prisma.notificationSetting.findMany({
    where: { disabledTypesCsv: { contains: "WEEKLY_DIGEST" } },
    select: { userId: true },
  });
  const disabledSet = new Set(disabled.map((x) => x.userId));

  // Users already received this week
  const already = await prisma.notification.findMany({
    where: { type: "WEEKLY_DIGEST", createdAt: { gte: weekStart, lt: weekEnd } },
    select: { userId: true },
  });
  const alreadySet = new Set(already.map((x) => x.userId));

  let processed = 0;
  let created = 0;

  const take = 500;
  let cursor: string | undefined;

  while (true) {
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true },
    });
    if (!users.length) break;

    for (const u of users) {
      processed++;
      if (disabledSet.has(u.id) || alreadySet.has(u.id)) continue;

      await prisma.notification.create({
        data: {
          userId: u.id,
          type: "WEEKLY_DIGEST",
          title: "Tóm tắt tuần",
          body: "Mở Notifications để xem cập nhật mới nhất trong tuần.",
          url: "/notifications",
          isRead: false,
        },
      });
      created++;
    }

    cursor = users[users.length - 1].id;
  }

  return { ok: true, processed, created, weekStart: weekStart.toISOString() };
}
