import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

/**
 * Lấy PIN từ body hoặc header X-PIN.
 */
export async function readPin(req: NextRequest): Promise<string | null> {
  const h = req.headers.get("x-pin") || req.headers.get("X-PIN");
  if (h) return String(h).trim();
  // body đã đọc ở route thì không dùng được nữa; vì vậy ở các route cần PIN, hãy truyền pin vào helper bằng cách khác.
  return null;
}

export async function setUserPin(userId: string, pin: string) {
  const hash = await bcrypt.hash(pin, 10);
  await prisma.userPin.upsert({
    where: { userId },
    update: { pinHash: hash, failedAttempts: 0, lockedUntil: null },
    create: { userId, pinHash: hash },
  });
}

export async function verifyUserPin(userId: string, pin: string) {
  const rec = await prisma.userPin.findUnique({ where: { userId } });
  if (!rec) return { ok: true, required: false as const }; // chưa set pin => không bắt buộc
  if (rec.lockedUntil && rec.lockedUntil.getTime() > Date.now()) {
    return { ok: false, required: true as const, reason: "LOCKED" as const, lockedUntil: rec.lockedUntil };
  }
  const ok = await bcrypt.compare(pin, rec.pinHash);
  if (ok) {
    await prisma.userPin.update({ where: { userId }, data: { failedAttempts: 0, lockedUntil: null } });
    return { ok: true, required: true as const };
  }
  const failed = rec.failedAttempts + 1;
  const lockedUntil = failed >= 5 ? new Date(Date.now() + 10 * 60 * 1000) : null; // lock 10 phút
  await prisma.userPin.update({ where: { userId }, data: { failedAttempts: failed, lockedUntil } });
  return { ok: false, required: true as const, reason: "INVALID" as const, failedAttempts: failed, lockedUntil };
}
