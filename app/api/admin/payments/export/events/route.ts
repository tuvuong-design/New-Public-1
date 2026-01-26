import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { csvResponse, toCsv } from "@/lib/payments/csv";

function parseDate(s: string | null, fallback: Date) {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: Request) {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const depositId = (url.searchParams.get("depositId") || "").trim();
  const type = (url.searchParams.get("type") || "").trim();
  const q = (url.searchParams.get("q") || "").trim();
  const from = parseDate(url.searchParams.get("from"), new Date(Date.now() - 24 * 60 * 60 * 1000));
  const to = parseDate(url.searchParams.get("to"), new Date());

  const where: any = { createdAt: { gte: from, lte: to } };
  if (depositId) where.depositId = depositId;
  if (type) where.type = type;
  if (q) where.OR = [{ message: { contains: q } }, { type: { contains: q } }, { depositId: { contains: q } }];

  const rows = await prisma.starDepositEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50_000,
  });

  const csv = toCsv(rows, [
    { key: "createdAt", header: "createdAt", value: (r) => r.createdAt.toISOString() },
    { key: "id", header: "eventId", value: (r) => r.id },
    { key: "depositId", header: "depositId", value: (r) => r.depositId },
    { key: "type", header: "type", value: (r) => r.type },
    { key: "message", header: "message", value: (r) => r.message || "" },
    { key: "dataJson", header: "dataJson", value: (r) => r.dataJson || "" },
  ]);

  return csvResponse(`deposit_events_${from.toISOString()}_${to.toISOString()}.csv`, csv);
}
