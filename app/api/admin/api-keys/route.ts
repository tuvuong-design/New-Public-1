import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-helpers";
import { z } from "zod";
import { jsonError } from "@/lib/api/errors";
import { randomApiKey, sha256, last4 } from "@/lib/api/crypto";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  allowedOrigins: z.array(z.string().url()).optional(),
  scopes: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return jsonError(403, "Forbidden");

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyLast4: true, allowedOrigins: true, scopes: true, isActive: true, createdAt: true, revokedAt: true },
  });
  return NextResponse.json({ ok: true, keys });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return jsonError(403, "Forbidden");

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid input", parsed.error.flatten());

  const key = randomApiKey("vs");
  const rec = await prisma.apiKey.create({
    data: {
      name: parsed.data.name,
      keyHash: sha256(key),
      keyLast4: last4(key),
      allowedOrigins: parsed.data.allowedOrigins ?? [],
      scopes: parsed.data.scopes ?? ["PUBLIC_READ"],
      createdById: session.user.id,
    },
  });

  // IMPORTANT: only return the raw key once on creation
  return NextResponse.json({ ok: true, apiKey: { id: rec.id, name: rec.name, keyLast4: rec.keyLast4 }, key });
}
