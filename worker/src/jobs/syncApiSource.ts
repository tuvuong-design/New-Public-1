import { prisma } from "../prisma";

function get(obj: any, pathStr: string) {
  const parts = pathStr.split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export async function syncApiSource(apiSourceId: string) {
  const src = await prisma.apiSource.findUnique({ where: { id: apiSourceId } });
  if (!src || !src.enabled) return { ok: true, skipped: true };

  let mapping: any = {};
  try {
    mapping = JSON.parse(src.mappingJson);
  } catch {
    mapping = {};
  }

  // Sync bookkeeping
  const setStatus = async (status: "OK" | "ERROR", err?: string) => {
    await prisma.apiSource.update({
      where: { id: src.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: err ? String(err).slice(0, 5000) : null,
      },
    });
  };

  // mapping example:
  // {
  //   "kind":"generic"|"peertube"|"zone3s_posts",
  //   "items":"data.items",
  //   "id":"id",
  //   "title":"title",
  //   "description":"description",
  //   "thumb":"thumb",
  //   "hls":"hls",
  //   "durationSec":"duration",
  //   "channelName":"channel.name",
  //   "channelSlug":"channel.slug",
  //   "assignToUserId":"...",
  //   "assignToUserEmailEnv":"SEED_PEERTUBE_OWNER_EMAIL"
  // }
  const kind = String(mapping.kind ?? "generic");
  const itemsPath = mapping.items ?? (kind === "peertube" ? "data" : "items");

  const existingMode = String(mapping.existingMode ?? "IMPORT_ALL");
  const fixedChannelId = mapping.fixedChannelId ? String(mapping.fixedChannelId) : null;

  const url = src.baseUrl;
  const headers: Record<string, string> = {};
  if (src.apiKey) {
    const headerName = String(mapping.apiKeyHeader ?? "Authorization");
    headers[headerName] = headerName.toLowerCase() === "authorization" ? `Bearer ${src.apiKey}` : src.apiKey;
  }

  try {
    const res = await fetch(url, { headers: Object.keys(headers).length ? headers : undefined });
    if (!res.ok) throw new Error(`fetch failed ${res.status}`);
    const data = await res.json();
    const items = get(data, itemsPath) ?? [];
    if (!Array.isArray(items)) throw new Error("items not array");

  const baseOrigin = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return "";
    }
  })();

  const toAbs = (maybeUrl: string) => {
    const s = String(maybeUrl ?? "").trim();
    if (!s) return "";
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("/")) return baseOrigin ? `${baseOrigin}${s}` : s;
    return baseOrigin ? `${baseOrigin}/${s}` : s;
  };

  let assignToUserId: string | null = null;
  if (mapping.assignToUserId) {
    assignToUserId = String(mapping.assignToUserId);
  } else if (mapping.assignToUserEmailEnv) {
    const email = process.env[String(mapping.assignToUserEmailEnv)] ?? "";
    if (email) {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      assignToUserId = u?.id ?? null;
    }
  }

    let processed = 0;
    let created = 0;
    let updated = 0;
    let skippedDeleted = 0;
    let skippedExisting = 0;

    for (const it of items.slice(0, 200)) {
    const rawId = String(get(it, mapping.id ?? (kind === "peertube" ? "uuid" : "id")) ?? "").trim();
    if (!rawId) continue;
    const externalId = `${src.prefix}:${rawId.slice(0, 200)}`;

    const title = String(get(it, mapping.title ?? (kind === "peertube" ? "name" : "title")) ?? "Untitled").slice(0, 200);
    const description = String(get(it, mapping.description ?? (kind === "peertube" ? "description" : "description")) ?? "");

    const thumbRaw = String(get(it, mapping.thumb ?? (kind === "peertube" ? "thumbnailPath" : "thumb")) ?? "");
    const hlsRaw = String(
      get(it, mapping.hls ?? (kind === "peertube" ? "streamingPlaylists.0.playlistUrl" : "hls")) ?? ""
    );
    const thumb = toAbs(thumbRaw);
    const hls = toAbs(hlsRaw);
    const durationSec = Number(get(it, mapping.durationSec ?? (kind === "peertube" ? "duration" : "durationSec")) ?? 0) || 0;

      // Optional channel sync
      let channelId: string | null = null;
      if (fixedChannelId) {
        const ch = await prisma.channel.findUnique({ where: { id: fixedChannelId }, select: { id: true } });
        channelId = ch?.id ?? null;
      }
      const channelName = String(
      get(it, mapping.channelName ?? (kind === "peertube" ? "channel.displayName" : "")) ??
        get(it, "channel.name") ??
        ""
    ).trim();
    const channelSlugRaw = String(get(it, mapping.channelSlug ?? (kind === "peertube" ? "channel.name" : "")) ?? "").trim();
      if (!fixedChannelId && channelName) {
      const slugBase = (channelSlugRaw || channelName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60);
      const slug = slugBase || `channel-${src.prefix}`;
      const ch = await prisma.channel.upsert({
        where: { slug },
        update: { name: channelName },
        create: { slug, name: channelName, description: "" },
        select: { id: true },
      });
      channelId = ch.id;
    }

      const existing = await prisma.video.findUnique({
      where: { externalId },
      select: { id: true, status: true, deletedAt: true },
    });
      if (existing && existingMode === "NEW_ONLY") {
        skippedExisting++;
        continue;
      }
    if (existing && (existing.status === "DELETED" || existing.deletedAt)) {
      skippedDeleted++;
      continue;
    }

    const upsert = await prisma.video.upsert({
      where: { externalId },
      update: {
        title,
        description,
        thumbKey: thumb || undefined,
        masterM3u8Key: hls || undefined,
        durationSec,
        embedUrl: hls || undefined,
        ...(channelId ? { channelId } : {}),
        ...(assignToUserId ? { authorId: assignToUserId } : {}),
      },
      create: {
        title,
        description,
        sourceKey: `external:${externalId}`,
        externalId,
        embedUrl: hls || undefined,
        thumbKey: thumb || undefined,
        masterM3u8Key: hls || undefined,
        durationSec,
        status: "PUBLISHED",
        ...(channelId ? { channelId } : {}),
        ...(assignToUserId ? { authorId: assignToUserId } : {}),
      },
      select: { id: true },
    });
      processed++;
      if (existing) updated++;
      else created++;
    }

    await setStatus("OK");
    return { ok: true, processed, created, updated, skippedDeleted, skippedExisting };
  } catch (e: any) {
    await setStatus("ERROR", e?.message || String(e));
    throw e;
  }
}
