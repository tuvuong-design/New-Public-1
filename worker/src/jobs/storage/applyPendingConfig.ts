import { prisma } from "../../prisma";
import { parsePending, normalizeBasePath } from "../../storage/config";

function summarize(cfg: any) {
  const o = cfg?.ftpOrigin || {};
  const h = cfg?.ftpHls || {};
  const d = cfg?.drive || {};
  return {
    r2: Boolean(cfg?.r2Enabled),
    ftpOrigin: { enabled: !!o.enabled, upload: !!o.uploadEnabled, host: o.host || "", basePath: o.basePath || "" },
    ftpHls: { enabled: !!h.enabled, upload: !!h.uploadEnabled, host: h.host || "", basePath: h.basePath || "", publicBaseUrl: h.publicBaseUrl || "" },
    drive: { enabled: !!d.enabled, folderId: d.folderId || "" },
  };
}

async function notifyAdmins(title: string, body: string, dataJson?: any) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admins.length) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({ userId: a.id, type: "SYSTEM", title, body, url: "/admin/storage", dataJson: dataJson ? JSON.stringify(dataJson) : null })),
  });
}

export async function applyPendingStorageConfigJob() {
  const row = await prisma.storageEndpointConfig.findUnique({ where: { id: 1 } });
  if (!row?.pendingJson || !row.pendingApplyAt) return { ok: true, applied: false };

  const now = new Date();
  if (row.pendingApplyAt > now) return { ok: true, applied: false, dueAt: row.pendingApplyAt.toISOString() };

  const pending = parsePending(row.pendingJson);
  if (!pending) return { ok: false, error: "PENDING_JSON_INVALID" };

  const currentShape = {
    r2Enabled: row.r2Enabled,
    ftpOrigin: { enabled: row.ftpOriginEnabled, uploadEnabled: row.ftpOriginUploadEnabled, host: row.ftpOriginHost, port: row.ftpOriginPort, username: row.ftpOriginUsername, basePath: row.ftpOriginBasePath, publicBaseUrl: row.ftpOriginPublicBaseUrl, secretId: row.ftpOriginSecretId },
    ftpHls: { enabled: row.ftpHlsEnabled, uploadEnabled: row.ftpHlsUploadEnabled, host: row.ftpHlsHost, port: row.ftpHlsPort, username: row.ftpHlsUsername, basePath: row.ftpHlsBasePath, publicBaseUrl: row.ftpHlsPublicBaseUrl, secretId: row.ftpHlsSecretId },
    drive: { enabled: row.driveEnabled, folderId: row.driveFolderId, secretId: row.driveSecretId },
  };

  await prisma.storageEndpointConfig.update({
    where: { id: 1 },
    data: {
      r2Enabled: true,

      ftpOriginEnabled: !!pending.ftpOrigin.enabled,
      ftpOriginUploadEnabled: !!pending.ftpOrigin.uploadEnabled,
      ftpOriginHost: pending.ftpOrigin.host || "",
      ftpOriginPort: Number((pending.ftpOrigin as any).port || 21),
      ftpOriginUsername: pending.ftpOrigin.username || "",
      ftpOriginBasePath: normalizeBasePath(pending.ftpOrigin.basePath || ""),
      ftpOriginPublicBaseUrl: pending.ftpOrigin.publicBaseUrl || "",
      ftpOriginSecretId: pending.ftpOrigin.enabled ? (pending.ftpOrigin.secretId || null) : null,

      ftpHlsEnabled: !!pending.ftpHls.enabled,
      ftpHlsUploadEnabled: !!pending.ftpHls.uploadEnabled,
      ftpHlsHost: pending.ftpHls.host || "",
      ftpHlsPort: Number((pending.ftpHls as any).port || 21),
      ftpHlsUsername: pending.ftpHls.username || "",
      ftpHlsBasePath: normalizeBasePath(pending.ftpHls.basePath || ""),
      ftpHlsPublicBaseUrl: pending.ftpHls.publicBaseUrl || "",
      ftpHlsSecretId: pending.ftpHls.enabled ? (pending.ftpHls.secretId || null) : null,

      driveEnabled: !!pending.drive.enabled,
      driveFolderId: pending.drive.folderId || "",
      driveSecretId: pending.drive.enabled ? (pending.drive.secretId || null) : null,

      pendingJson: null,
      pendingApplyAt: null,
      pendingSetById: null,
    },
  });

  await prisma.nftEventLog.create({
    data: {
      actorId: null,
      action: "STORAGE_CONFIG_APPLIED_WORKER",
      dataJson: JSON.stringify({ applyAt: now.toISOString(), from: summarize(currentShape), to: summarize(pending) }),
    },
  });

  await notifyAdmins(
    "Storage config applied (auto)",
    `Worker auto-applied pending Storage config. Apply at ${now.toLocaleString()}\nFROM: ${JSON.stringify(summarize(currentShape))}\nTO:   ${JSON.stringify(summarize(pending))}`,
    { applyAt: now.toISOString(), from: currentShape, to: pending }
  );

  return { ok: true, applied: true };
}
