import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { PaymentProvider } from "@prisma/client";

const schema = z.object({
  env: z.string().min(1).max(40),
  provider: z.string().min(1),
  name: z.string().min(1).max(80),
  value: z.string().min(1).max(20_000),
  active: z.boolean().optional().default(true),
});

const PROVIDERS = new Set(["ALCHEMY", "QUICKNODE", "HELIUS", "TRONGRID", "MANUAL"]);

export async function POST(req: Request) {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY", details: parsed.error.flatten() }, { status: 400 });

  if (!PROVIDERS.has(parsed.data.provider)) return Response.json({ error: "INVALID_PROVIDER" }, { status: 400 });

  const row = await prisma.paymentProviderSecret.upsert({
    where: {
      env_provider_name: {
        env: parsed.data.env,
        provider: parsed.data.provider as PaymentProvider,
        name: parsed.data.name,
      },
    },
    create: {
      env: parsed.data.env,
      provider: parsed.data.provider as PaymentProvider,
      name: parsed.data.name,
      value: parsed.data.value,
      active: parsed.data.active,
    },
    update: {
      value: parsed.data.value,
      active: parsed.data.active,
    },
  });

  return Response.json({ ok: true, row });
}

export async function GET(req: Request) {
  const session = await auth();
  try {
    requireAdmin(session);
  } catch {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "").trim();
  const provider = (url.searchParams.get("provider") || "").trim();
  const where: any = {};
  if (env) where.env = env;
  if (provider) where.provider = provider;
  const rows = await prisma.paymentProviderSecret.findMany({ where, orderBy: { updatedAt: "desc" }, take: 200 });
  return Response.json({ rows });
}
