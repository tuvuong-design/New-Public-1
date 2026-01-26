import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { z } from "zod";
import crypto from "node:crypto";

export const runtime = "nodejs";

const AllowedEvents = ["TIP_RECEIVED"] as const;

function allowlist() {
  const csv = String(env.CREATOR_WEBHOOK_ALLOWLIST || "").trim();
  return new Set(csv ? csv.split(",").map((s) => s.trim()).filter(Boolean) : []);
}

function isPrivateHostname(host: string) {
  const h = host.toLowerCase();
  if (h === "localhost") return true;
  if (/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(h)) return true;
  return false;
}

function validateUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false as const, error: "URL_INVALID" };
  }
  if (u.protocol !== "https:") return { ok: false as const, error: "URL_MUST_BE_HTTPS" };
  if (isPrivateHostname(u.hostname)) return { ok: false as const, error: "URL_PRIVATE_HOST" };
  const list = allowlist();
  if (list.size > 0 && !list.has(u.hostname)) return { ok: false as const, error: "URL_NOT_ALLOWLISTED" };
  return { ok: true as const, url: u.toString() };
}

const createSchema = z.object({
  url: z.string().min(1).max(500),
  secret: z.string().min(8).max(200).optional(),
  enabled: z.boolean().optional().default(true),
  events: z.array(z.enum(AllowedEvents)).optional().default(["TIP_RECEIVED"]),
});

export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const rows = await prisma.creatorWebhookEndpoint.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, enabled: true, eventsCsv: true, createdAt: true, updatedAt: true },
  });

  return Response.json({
    ok: true,
    items: rows.map((r) => ({
      id: r.id,
      url: r.url,
      enabled: r.enabled,
      events: (r.eventsCsv || "").split(",").map((x) => x.trim()).filter(Boolean),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    allowedEvents: AllowedEvents,
    allowlist: Array.from(allowlist()),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = createSchema.parse(await req.json());
  const v = validateUrl(body.url);
  if (!v.ok) return Response.json({ ok: false, error: v.error }, { status: 400 });

  const secret = body.secret?.trim() || crypto.randomBytes(24).toString("hex");
  const eventsCsv = (body.events || ["TIP_RECEIVED"]).join(",");

  const created = await prisma.creatorWebhookEndpoint.create({
    data: { userId, url: v.url, secret, eventsCsv, enabled: body.enabled },
    select: { id: true, url: true, enabled: true, eventsCsv: true, createdAt: true, updatedAt: true },
  });

  // Return secret ONLY on create (so user can copy it).
  return Response.json({
    ok: true,
    item: {
      id: created.id,
      url: created.url,
      enabled: created.enabled,
      events: (created.eventsCsv || "").split(",").map((x) => x.trim()).filter(Boolean),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      secret,
    },
  });
}
