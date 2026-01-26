import { z } from "zod";
import { canAccessInstallWizard } from "@/lib/install/guard";

export const runtime = "nodejs";

const schema = z.object({ databaseUrl: z.string().min(1) });

export async function POST(req: Request) {
  if (!canAccessInstallWizard()) return new Response("Not found", { status: 404 });
  const body = schema.parse(await req.json());

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient({ datasources: { db: { url: body.databaseUrl } } });
    try {
      // MySQL
      await prisma.$queryRawUnsafe("SELECT 1");
    } finally {
      await prisma.$disconnect();
    }
    return Response.json({ ok: true, message: "DB connection OK" });
  } catch (e: any) {
    return Response.json({ ok: false, message: e?.message || "DB connection failed" }, { status: 400 });
  }
}
