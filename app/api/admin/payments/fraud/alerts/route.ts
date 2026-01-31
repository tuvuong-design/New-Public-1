import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function clampInt(v: any, min: number, max: number, def: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function GET(req: Request) {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "OPEN").toUpperCase();
  const kind = (url.searchParams.get("kind") || "").trim();
  const severity = (url.searchParams.get("severity") || "").trim();
  const q = (url.searchParams.get("q") || "").trim();

  const page = clampInt(url.searchParams.get("page"), 1, 5000, 1);
  const pageSize = clampInt(url.searchParams.get("pageSize"), 5, 100, 25);
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (["OPEN", "ACKED", "RESOLVED"].includes(status)) where.status = status;
  if (kind) where.kind = kind;
  if (severity) where.severity = severity;

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { message: { contains: q } },
      { dedupeKey: { contains: q } },
      { user: { email: { contains: q } } },
      { deposit: { txHash: { contains: q } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.fraudAlert.count({ where }),
    prisma.fraudAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true } },
        deposit: { select: { id: true, status: true, chain: true, txHash: true, userId: true } },
        acknowledgedBy: { select: { id: true, email: true } },
        resolvedBy: { select: { id: true, email: true } },
      },
    }),
  ]);

  return Response.json({ ok: true, page, pageSize, total, items });
}
