import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Client } from "basic-ftp";

export const runtime = "nodejs";

async function notifyAdmins(title: string, body: string, dataJson?: any) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admins.length) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: "SYSTEM",
      title,
      body,
      url: "/admin/storage",
      dataJson: dataJson ? JSON.stringify(dataJson) : null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  requireAdmin(session);
  const userId = (session?.user as any)?.id as string | undefined;

  const payload = await req.json().catch(() => ({} as any));
  const which = String(payload.which || "");
  const host = String(payload.host || "").trim();
  const port = Number(payload.port || 21);
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const basePath = String(payload.basePath || "").trim();

  if (!host || !username) return Response.json({ error: "HOST_USERNAME_REQUIRED" }, { status: 400 });

  const client = new Client(10_000);
  try {
    await client.access({ host, port, user: username, password });
    if (basePath) {
      await client.ensureDir(basePath);
    }
    await client.list(basePath || ".");

    await prisma.nftEventLog.create({
      data: {
        actorId: userId || null,
        action: "STORAGE_VERIFY_FTP",
        dataJson: JSON.stringify({ which, host, port, username, basePath }),
      },
    });

    return Response.json({ ok: true, message: `FTP ${which || ""} verified` });
  } catch (e: any) {
    const msg = String(e?.message || e);
    await prisma.nftEventLog.create({
      data: {
        actorId: userId || null,
        action: "STORAGE_VERIFY_FTP_FAILED",
        dataJson: JSON.stringify({ which, host, port, username, basePath, error: msg }),
      },
    });
    await notifyAdmins("Storage FTP verify failed", `FTP verify failed (${which}) for ${host}:${port} - ${msg}`, { which, host, port, username, basePath, error: msg });
    return Response.json({ error: msg }, { status: 400 });
  } finally {
    client.close();
  }
}
