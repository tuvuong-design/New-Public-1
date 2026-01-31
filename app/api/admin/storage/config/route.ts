import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { normalizeBasePath } from "@/lib/storage/config";
import { createStorageSecret, getStorageEndpointConfig, parsePending } from "@/lib/storage/config";

export const runtime = "nodejs";

function clean(form: FormDataEntryValue | null) {
  return String(form || "").trim();
}

function toBool(v: FormDataEntryValue | null) {
  if (v === null) return false;
  const s = String(v);
  return s === "on" || s === "true" || s === "1";
}

function toNum(v: FormDataEntryValue | null, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

function toPct0to100(v: FormDataEntryValue | null, d: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function cleanUrlHttps(v: FormDataEntryValue | null) {
  const s = clean(v);
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function addHours(d: Date, hours: number) {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

async function notifyAdmins(args: { title: string; body: string; dataJson?: any; url?: string }) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admins.length) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: "SYSTEM",
      title: args.title,
      body: args.body,
      url: args.url,
      dataJson: args.dataJson ? JSON.stringify(args.dataJson) : null,
    })),
    skipDuplicates: false,
  });
}

function summarizeConfig(cfg: any) {
  // Keep short but clear for notifications.
  const o = cfg?.ftpOrigin || {};
  const h = cfg?.ftpHls || {};
  const d = cfg?.drive || {};
  const r2p = cfg?.r2Playback || {};
  return {
    r2: Boolean(cfg?.r2Enabled),
    r2Playback: {
      a: r2p.publicBaseUrlA || "",
      b: r2p.publicBaseUrlB || "",
      split: Number.isFinite(Number(r2p.abSplitPercent)) ? Number(r2p.abSplitPercent) : 50,
    },
    ftpOrigin: { enabled: !!o.enabled, upload: !!o.uploadEnabled, host: o.host || "", basePath: o.basePath || "" },
    ftpHls: { enabled: !!h.enabled, upload: !!h.uploadEnabled, host: h.host || "", basePath: h.basePath || "", publicBaseUrl: h.publicBaseUrl || "" },
    drive: { enabled: !!d.enabled, folderId: d.folderId || "" },
  };
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  requireAdmin(session);
  if (!userId) return new Response("UNAUTHORIZED", { status: 401 });

  const form = await req.formData();
  const action = clean(form.get("action"));

  const delayHours = 24; // fixed per requirement

  const row = await getStorageEndpointConfig();
  const currentShape = {
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

  if (action === "SET_PENDING") {
    const r2PublicBaseUrlA = cleanUrlHttps(form.get("r2PublicBaseUrlA")) || currentShape.r2Playback.publicBaseUrlA;
    const r2PublicBaseUrlB = cleanUrlHttps(form.get("r2PublicBaseUrlB")) || currentShape.r2Playback.publicBaseUrlB;
    const r2AbSplitPercent = toPct0to100(form.get("r2AbSplitPercent"), currentShape.r2Playback.abSplitPercent);

    // Parse inputs
    const ftpOriginEnabled = toBool(form.get("ftpOriginEnabled"));
    const ftpOriginUploadEnabled = toBool(form.get("ftpOriginUploadEnabled"));
    const ftpOriginHost = clean(form.get("ftpOriginHost"));
    const ftpOriginPort = toNum(form.get("ftpOriginPort"), 21);
    const ftpOriginUsername = clean(form.get("ftpOriginUsername"));
    const ftpOriginPassword = clean(form.get("ftpOriginPassword"));
    const ftpOriginBasePath = normalizeBasePath(clean(form.get("ftpOriginBasePath")));
    const ftpOriginPublicBaseUrl = clean(form.get("ftpOriginPublicBaseUrl"));

    const ftpHlsEnabled = toBool(form.get("ftpHlsEnabled"));
    const ftpHlsUploadEnabled = toBool(form.get("ftpHlsUploadEnabled"));
    const ftpHlsHost = clean(form.get("ftpHlsHost"));
    const ftpHlsPort = toNum(form.get("ftpHlsPort"), 21);
    const ftpHlsUsername = clean(form.get("ftpHlsUsername"));
    const ftpHlsPassword = clean(form.get("ftpHlsPassword"));
    const ftpHlsBasePath = normalizeBasePath(clean(form.get("ftpHlsBasePath")));
    const ftpHlsPublicBaseUrl = clean(form.get("ftpHlsPublicBaseUrl"));

    const driveEnabled = toBool(form.get("driveEnabled"));
    const driveFolderId = clean(form.get("driveFolderId"));
    const driveServiceAccountJson = clean(form.get("driveServiceAccountJson"));

    // Validate minimal
    let ftpOriginSecretId = currentShape.ftpOrigin.secretId || null;
    let ftpHlsSecretId = currentShape.ftpHls.secretId || null;
    let driveSecretId = currentShape.drive.secretId || null;

    if (ftpOriginEnabled) {
      if (!ftpOriginHost || !ftpOriginUsername) return Response.json({ error: "FTP_ORIGIN_REQUIRED" }, { status: 400 });
      if (!ftpOriginSecretId && !ftpOriginPassword) return Response.json({ error: "FTP_ORIGIN_PASSWORD_REQUIRED" }, { status: 400 });
      if (ftpOriginPassword) {
        const sec = await createStorageSecret({ type: "FTP_ORIGIN", value: { password: ftpOriginPassword }, createdById: userId });
        ftpOriginSecretId = sec.id;
      }
    }

    if (ftpHlsEnabled) {
      if (!ftpHlsHost || !ftpHlsUsername) return Response.json({ error: "FTP_HLS_REQUIRED" }, { status: 400 });
      if (!ftpHlsPublicBaseUrl) return Response.json({ error: "FTP_HLS_PUBLIC_BASE_URL_REQUIRED" }, { status: 400 });
      if (!ftpHlsSecretId && !ftpHlsPassword) return Response.json({ error: "FTP_HLS_PASSWORD_REQUIRED" }, { status: 400 });
      if (ftpHlsPassword) {
        const sec = await createStorageSecret({ type: "FTP_HLS", value: { password: ftpHlsPassword }, createdById: userId });
        ftpHlsSecretId = sec.id;
      }
    }

    if (driveEnabled) {
      if (!driveFolderId) return Response.json({ error: "DRIVE_FOLDER_REQUIRED" }, { status: 400 });
      if (!driveSecretId && !driveServiceAccountJson) return Response.json({ error: "DRIVE_SERVICE_ACCOUNT_JSON_REQUIRED" }, { status: 400 });
      if (driveServiceAccountJson) {
        // Validate JSON quickly
        try { JSON.parse(driveServiceAccountJson); } catch { return Response.json({ error: "DRIVE_JSON_INVALID" }, { status: 400 }); }
        const sec = await createStorageSecret({ type: "DRIVE_SERVICE_ACCOUNT", value: { json: driveServiceAccountJson }, createdById: userId });
        driveSecretId = sec.id;
      }
    }

    const nextShape = {
      r2Enabled: true,
      r2Playback: {
        publicBaseUrlA: r2PublicBaseUrlA,
        publicBaseUrlB: r2PublicBaseUrlB,
        abSplitPercent: r2AbSplitPercent,
      },
      ftpOrigin: {
        enabled: ftpOriginEnabled,
        uploadEnabled: ftpOriginUploadEnabled,
        host: ftpOriginHost,
        port: ftpOriginPort,
        username: ftpOriginUsername,
        basePath: ftpOriginBasePath,
        publicBaseUrl: ftpOriginPublicBaseUrl,
        secretId: ftpOriginEnabled ? ftpOriginSecretId : null,
      },
      ftpHls: {
        enabled: ftpHlsEnabled,
        uploadEnabled: ftpHlsUploadEnabled,
        host: ftpHlsHost,
        port: ftpHlsPort,
        username: ftpHlsUsername,
        basePath: ftpHlsBasePath,
        publicBaseUrl: ftpHlsPublicBaseUrl,
        secretId: ftpHlsEnabled ? ftpHlsSecretId : null,
      },
      drive: {
        enabled: driveEnabled,
        folderId: driveFolderId,
        secretId: driveEnabled ? driveSecretId : null,
      },
    };

    const now = new Date();
    const pendingApplyAt = addHours(now, delayHours);

    await prisma.storageEndpointConfig.update({
      where: { id: 1 },
      data: {
        pendingJson: JSON.stringify(nextShape),
        pendingApplyAt,
        pendingSetById: userId,
      },
    });

    await prisma.nftEventLog.create({
      data: {
        actorId: userId,
        action: "STORAGE_CONFIG_PENDING_SET",
        dataJson: JSON.stringify({
          pendingApplyAt: pendingApplyAt.toISOString(),
          from: summarizeConfig(currentShape),
          to: summarizeConfig(nextShape),
        }),
      },
    });

    const actorLabel = String((session?.user as any)?.email || (session?.user as any)?.name || userId);

    await notifyAdmins({
      title: "Storage config change scheduled",
      body: `${actorLabel} scheduled Storage config change. Apply at ${pendingApplyAt.toLocaleString()}\nFROM: ${JSON.stringify(summarizeConfig(currentShape))}\nTO:   ${JSON.stringify(summarizeConfig(nextShape))}`,
      url: "/admin/storage",
      dataJson: { pendingApplyAt: pendingApplyAt.toISOString(), actor: actorLabel, from: currentShape, to: nextShape },
    });

    return Response.redirect(new URL("/admin/storage", req.url));
  }

  if (action === "CANCEL_PENDING") {
    const pending = parsePending(row.pendingJson);

    await prisma.storageEndpointConfig.update({
      where: { id: 1 },
      data: { pendingJson: null, pendingApplyAt: null, pendingSetById: null },
    });

    await prisma.nftEventLog.create({
      data: {
        actorId: userId,
        action: "STORAGE_CONFIG_PENDING_CANCELLED",
        dataJson: JSON.stringify({ pendingWas: pending ? summarizeConfig(pending) : null }),
      },
    });

    const actorLabel = String((session?.user as any)?.email || (session?.user as any)?.name || userId);

    await notifyAdmins({
      title: "Storage config pending cancelled",
      body: `${actorLabel} cancelled pending Storage config change.`,
      url: "/admin/storage",
      dataJson: { actor: actorLabel, pendingWas: pending },
    });

    return Response.redirect(new URL("/admin/storage", req.url));
  }

  if (action === "APPLY_PENDING") {
    if (!row.pendingJson || !row.pendingApplyAt) return Response.redirect(new URL("/admin/storage", req.url));
    const now = new Date();
    if (row.pendingApplyAt > now) {
      const url = new URL("/admin/storage", req.url);
      url.searchParams.set("err", "NOT_DUE_YET");
      url.searchParams.set("applyAt", row.pendingApplyAt.toISOString());
      return Response.redirect(url);
    }

    const pending = parsePending(row.pendingJson);
    if (!pending) return Response.json({ error: "PENDING_JSON_INVALID" }, { status: 400 });

    await prisma.storageEndpointConfig.update({
      where: { id: 1 },
      data: {
        r2Enabled: true,

        r2PublicBaseUrlA: String((pending as any)?.r2Playback?.publicBaseUrlA || "").trim(),
        r2PublicBaseUrlB: String((pending as any)?.r2Playback?.publicBaseUrlB || "").trim(),
        r2AbSplitPercent: Number.isFinite(Number((pending as any)?.r2Playback?.abSplitPercent)) ? Number((pending as any).r2Playback.abSplitPercent) : 50,
        ftpOriginEnabled: !!pending.ftpOrigin.enabled,
        ftpOriginUploadEnabled: !!pending.ftpOrigin.uploadEnabled,
        ftpOriginHost: pending.ftpOrigin.host || "",
        ftpOriginPort: Number(pending.ftpOrigin.port || 21),
        ftpOriginUsername: pending.ftpOrigin.username || "",
        ftpOriginBasePath: normalizeBasePath(pending.ftpOrigin.basePath || ""),
        ftpOriginPublicBaseUrl: pending.ftpOrigin.publicBaseUrl || "",
        ftpOriginSecretId: pending.ftpOrigin.enabled ? (pending.ftpOrigin.secretId || null) : null,

        ftpHlsEnabled: !!pending.ftpHls.enabled,
        ftpHlsUploadEnabled: !!pending.ftpHls.uploadEnabled,
        ftpHlsHost: pending.ftpHls.host || "",
        ftpHlsPort: Number(pending.ftpHls.port || 21),
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
        actorId: userId,
        action: "STORAGE_CONFIG_APPLIED_MANUAL",
        dataJson: JSON.stringify({ from: summarizeConfig(currentShape), to: summarizeConfig(pending) }),
      },
    });

    const actorLabel = String((session?.user as any)?.email || (session?.user as any)?.name || userId);

    await notifyAdmins({
      title: "Storage config applied",
      body: `${actorLabel} applied Storage config change.\nFROM: ${JSON.stringify(summarizeConfig(currentShape))}\nTO:   ${JSON.stringify(summarizeConfig(pending))}`,
      url: "/admin/storage",
      dataJson: { actor: actorLabel, from: currentShape, to: pending },
    });

    return Response.redirect(new URL("/admin/storage", req.url));
  }

  return Response.json({ error: "ACTION_NOT_SUPPORTED" }, { status: 400 });
}
