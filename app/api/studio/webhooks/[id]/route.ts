import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { z } from "zod";

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

const patchSchema = z.object({
  url: z.string().min(1).max(500).optional(),
  enabled: z.boolean().optional(),
  events: z.array(z.enum(AllowedEvents)).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const row = await prisma.creatorWebhookEndpoint.findUnique({ where: { id: params.id }, select: { id: true, userId: true } });
  if (!row) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (row.userId !== userId && session?.user?.role !== "ADMIN") return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = patchSchema.parse(await req.json());
  const data: any = {};

  if (body.url) {
    const v = validateUrl(body.url);
    if (!v.ok) return Response.json({ ok: false, error: v.error }, { status: 400 });
    data.url = v.url;
  }
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.events) data.eventsCsv = body.events.join(",");

  const updated = await prisma.creatorWebhookEndpoint.update({
    where: { id: params.id },
    data,
    select: { id: true, url: true, enabled: true, eventsCsv: true, createdAt: true, updatedAt: true },
  });

  return Response.json({
    ok: true,
    item: {
      id: updated.id,
      url: updated.url,
      enabled: updated.enabled,
      events: (updated.eventsCsv || "").split(",").map((x) => x.trim()).filter(Boolean),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const row = await prisma.creatorWebhookEndpoint.findUnique({ where: { id: params.id }, select: { id: true, userId: true } });
  if (!row) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (row.userId !== userId && session?.user?.role !== "ADMIN") return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  await prisma.creatorWebhookEndpoint.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
