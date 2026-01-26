import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const createSchema = z.object({
  chain: z.string().min(2).max(20),
  collectionAddress: z.string().max(200).nullable().optional(),
  tokenMint: z.string().max(200).nullable().optional(),
  minBalance: z.number().int().min(1).max(1_000_000).optional().default(1),
  mapsToTier: z.enum(["BRONZE", "SILVER", "GOLD"]),
  enabled: z.boolean().optional().default(true),
});

export async function GET() {
  const session = await auth();
  const creatorId = (session?.user as any)?.id as string | undefined;
  if (!creatorId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const rules = await prisma.nftGateRule.findMany({
    where: { creatorId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ ok: true, rules });
}

export async function POST(req: Request) {
  const session = await auth();
  const creatorId = (session?.user as any)?.id as string | undefined;
  if (!creatorId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const body = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ ok: false, message: "BAD_REQUEST" }, { status: 400 });

  const data = body.data;

  if (!data.collectionAddress && !data.tokenMint) {
    return Response.json({ ok: false, message: "MISSING_COLLECTION_OR_MINT" }, { status: 400 });
  }

  const row = await prisma.nftGateRule.create({
    data: {
      creatorId,
      chain: data.chain as any,
      collectionAddress: data.collectionAddress || null,
      tokenMint: data.tokenMint || null,
      minBalance: data.minBalance,
      mapsToTier: data.mapsToTier as any,
      enabled: data.enabled,
    },
  });

  return Response.json({ ok: true, rule: row });
}

export async function DELETE(req: Request) {
  const session = await auth();
  const creatorId = (session?.user as any)?.id as string | undefined;
  if (!creatorId) return Response.json({ ok: false, message: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  if (!id) return Response.json({ ok: false, message: "BAD_REQUEST" }, { status: 400 });

  const row = await prisma.nftGateRule.findUnique({ where: { id } });
  if (!row || row.creatorId !== creatorId) return Response.json({ ok: false, message: "NOT_FOUND" }, { status: 404 });

  await prisma.nftGateRule.delete({ where: { id } });
  return Response.json({ ok: true });
}
