import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  requireAdmin(session);
  const userId = (session?.user as any)?.id as string | undefined;

  const payload = await req.json().catch(() => ({} as any));
  const folderId = String(payload.folderId || "").trim();
  const jsonStr = String(payload.serviceAccountJson || "").trim();

  if (!folderId) return Response.json({ error: "FOLDER_ID_REQUIRED" }, { status: 400 });
  if (!jsonStr) return Response.json({ error: "SERVICE_ACCOUNT_JSON_REQUIRED" }, { status: 400 });

  let creds: any = null;
  try {
    creds = JSON.parse(jsonStr);
  } catch {
    return Response.json({ error: "JSON_INVALID" }, { status: 400 });
  }

  try {
    const authClient = new google.auth.GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/drive"] });
    const drive = google.drive({ version: "v3", auth: await authClient.getClient() });
    const res = await drive.files.get({ fileId: folderId, fields: "id,name,mimeType" });

    await prisma.nftEventLog.create({
      data: { actorId: userId || null, action: "STORAGE_VERIFY_DRIVE", dataJson: JSON.stringify({ folderId, name: res.data?.name, mimeType: res.data?.mimeType }) },
    });

    return Response.json({ ok: true, message: `Drive verified: ${res.data?.name || folderId}` });
  } catch (e: any) {
    const msg = String(e?.message || e);
    await prisma.nftEventLog.create({
      data: { actorId: userId || null, action: "STORAGE_VERIFY_DRIVE_FAILED", dataJson: JSON.stringify({ folderId, error: msg }) },
    });
    return Response.json({ error: msg }, { status: 400 });
  }
}
