import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Client } from "basic-ftp";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";

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
  const filename = `__videoshare_test_${Date.now()}.txt`;
  const tmp = path.join(os.tmpdir(), filename);
  fs.writeFileSync(tmp, `videoshare storage test ${new Date().toISOString()}\n`);

  try {
    await client.access({ host, port, user: username, password });
    if (basePath) await client.ensureDir(basePath);

    const remotePath = basePath ? `${basePath.replace(/\/+$/, "")}/${filename}` : filename;
    await client.uploadFrom(tmp, remotePath);
    await client.remove(remotePath);

    await prisma.nftEventLog.create({
      data: {
        actorId: userId || null,
        action: "STORAGE_TEST_UPLOAD_FTP",
        dataJson: JSON.stringify({ which, host, port, username, basePath }),
      },
    });

    return Response.json({ ok: true, message: `FTP ${which || ""} test upload ok` });
  } catch (e: any) {
    const msg = String(e?.message || e);
    await prisma.nftEventLog.create({
      data: {
        actorId: userId || null,
        action: "STORAGE_TEST_UPLOAD_FTP_FAILED",
        dataJson: JSON.stringify({ which, host, port, username, basePath, error: msg }),
      },
    });
    return Response.json({ error: msg }, { status: 400 });
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
    client.close();
  }
}
