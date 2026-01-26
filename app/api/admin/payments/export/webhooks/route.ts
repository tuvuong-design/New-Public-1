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
  const provider = (url.searchParams.get("provider") || "").trim();
  const status = (url.searchParams.get("status") || "").trim();
  const chain = (url.searchParams.get("chain") || "").trim();
  const q = (url.searchParams.get("q") || "").trim();
  const from = parseDate(url.searchParams.get("from"), new Date(Date.now() - 24 * 60 * 60 * 1000));
  const to = parseDate(url.searchParams.get("to"), new Date());

  const where: any = { createdAt: { gte: from, lte: to } };
  if (provider) where.provider = provider;
  if (status) where.status = status;
  if (chain) where.chain = chain;
  if (q) {
    where.OR = [
      { depositId: { contains: q } },
      { sha256: { contains: q } },
      { failureReason: { contains: q } },
      { endpoint: { contains: q } },
    ];
  }

  const rows = await prisma.webhookAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50_000,
  });

  const csv = toCsv(rows, [
    { key: "createdAt", header: "createdAt", value: (r) => r.createdAt.toISOString() },
    { key: "id", header: "auditId", value: (r) => r.id },
    { key: "provider", header: "provider", value: (r) => r.provider },
    { key: "chain", header: "chain", value: (r) => r.chain || "" },
    { key: "endpoint", header: "endpoint", value: (r) => r.endpoint },
    { key: "status", header: "status", value: (r) => r.status },
    { key: "depositId", header: "depositId", value: (r) => r.depositId || "" },
    { key: "sha256", header: "sha256", value: (r) => r.sha256 },
    { key: "failureReason", header: "failureReason", value: (r) => r.failureReason || "" },
  ]);

  return csvResponse(`webhook_logs_${from.toISOString()}_${to.toISOString()}.csv`, csv);
}
