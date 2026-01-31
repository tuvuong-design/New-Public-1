import { prisma } from "../prisma";
import { openJson } from "./crypto";

export type StorageFtpCfg = {
  enabled: boolean;
  uploadEnabled: boolean;
  host: string;
  port: number;
  username: string;
  basePath: string;
  publicBaseUrl: string;
  secretId?: string | null;
};

export type StorageDriveCfg = {
  enabled: boolean;
  folderId: string;
  secretId?: string | null;
};

export type StorageShape = {
  r2Enabled: boolean;
  r2Playback: {
    publicBaseUrlA: string;
    publicBaseUrlB: string;
    abSplitPercent: number;
  };
  ftpOrigin: StorageFtpCfg;
  ftpHls: StorageFtpCfg;
  drive: StorageDriveCfg;
};

export function normalizeBasePath(p: string) {
  const s = String(p || "").trim();
  if (!s) return "";
  return s.replace(/\\+/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export async function getStorageRow() {
  return prisma.storageEndpointConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      r2Enabled: true,
      r2PublicBaseUrlA: "",
      r2PublicBaseUrlB: "",
      r2AbSplitPercent: 50,
      ftpOriginEnabled: false,
      ftpOriginUploadEnabled: false,
      ftpOriginHost: "",
      ftpOriginPort: 21,
      ftpOriginUsername: "",
      ftpOriginBasePath: "",
      ftpOriginPublicBaseUrl: "",
      ftpHlsEnabled: false,
      ftpHlsUploadEnabled: false,
      ftpHlsHost: "",
      ftpHlsPort: 21,
      ftpHlsUsername: "",
      ftpHlsBasePath: "",
      ftpHlsPublicBaseUrl: "",
      driveEnabled: false,
      driveFolderId: "",
    },
  });
}

export async function getStorageShape(): Promise<StorageShape> {
  const row = await getStorageRow();
  return {
    r2Enabled: row.r2Enabled,
    r2Playback: {
      publicBaseUrlA: String(row.r2PublicBaseUrlA || "").trim(),
      publicBaseUrlB: String(row.r2PublicBaseUrlB || "").trim(),
      abSplitPercent: Number.isFinite(Number(row.r2AbSplitPercent)) ? Number(row.r2AbSplitPercent) : 50,
    },
    ftpOrigin: {
      enabled: row.ftpOriginEnabled,
      uploadEnabled: row.ftpOriginUploadEnabled,
      host: row.ftpOriginHost,
      port: row.ftpOriginPort,
      username: row.ftpOriginUsername,
      basePath: row.ftpOriginBasePath,
      publicBaseUrl: row.ftpOriginPublicBaseUrl,
      secretId: row.ftpOriginSecretId,
    },
    ftpHls: {
      enabled: row.ftpHlsEnabled,
      uploadEnabled: row.ftpHlsUploadEnabled,
      host: row.ftpHlsHost,
      port: row.ftpHlsPort,
      username: row.ftpHlsUsername,
      basePath: row.ftpHlsBasePath,
      publicBaseUrl: row.ftpHlsPublicBaseUrl,
      secretId: row.ftpHlsSecretId,
    },
    drive: {
      enabled: row.driveEnabled,
      folderId: row.driveFolderId,
      secretId: row.driveSecretId,
    },
  };
}

export function parsePending(pendingJson: string | null): StorageShape | null {
  if (!pendingJson) return null;
  try {
    const raw = JSON.parse(pendingJson) as any;
    return {
      r2Enabled: Boolean(raw?.r2Enabled ?? true),
      r2Playback: {
        publicBaseUrlA: String(raw?.r2Playback?.publicBaseUrlA || "").trim(),
        publicBaseUrlB: String(raw?.r2Playback?.publicBaseUrlB || "").trim(),
        abSplitPercent: Number.isFinite(Number(raw?.r2Playback?.abSplitPercent)) ? Number(raw.r2Playback.abSplitPercent) : 50,
      },
      ftpOrigin: raw?.ftpOrigin,
      ftpHls: raw?.ftpHls,
      drive: raw?.drive,
    } as StorageShape;
  } catch {
    return null;
  }
}

export async function decryptSecret<T>(secretId?: string | null): Promise<T | null> {
  if (!secretId) return null;
  const s = await prisma.storageSecret.findUnique({ where: { id: secretId } });
  if (!s) return null;
  return openJson<T>(s.encryptedJson);
}
