import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function csvEscape(s: string) {
  const v = String(s ?? "");
  if (/[\n\r",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(req: Request) {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return new Response("FORBIDDEN", { status: 403 });
  }

  const url = new URL(req.url);
  const userId = String(url.searchParams.get("userId") ?? "").trim();
  const email = String(url.searchParams.get("email") ?? "").trim();
  const type = String(url.searchParams.get("type") ?? "").trim();
  const from = String(url.searchParams.get("from") ?? "").trim();
  const to = String(url.searchParams.get("to") ?? "").trim();
  const take = Math.min(5000, Math.max(1, Number(url.searchParams.get("take") ?? 200)));

  const where: any = {};
  if (type) where.type = type;
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (email && !userId) {
    const u = await prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (u) where.userId = u.id;
  }

  const rows = await prisma.starTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { id: true, email: true } }, video: { select: { id: true, title: true } } },
  });

  const header = ["createdAt", "txId", "userId", "email", "type", "delta", "stars", "depositId", "videoId", "videoTitle", "note"].join(",");
  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      r.id,
      r.userId,
      r.user?.email ?? "",
      r.type,
      String(r.delta),
      String(r.stars ?? 0),
      r.depositId ?? "",
      r.videoId ?? "",
      r.video?.title ?? "",
      r.note ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );

  const csv = [header, ...lines].join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=stars-ledger-${Date.now()}.csv`,
      "cache-control": "no-store",
    },
  });
}
