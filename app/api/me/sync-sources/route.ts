import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  url: z.string().min(8),
  kind: z.enum(["peertube", "zone3s"]).optional(),
  channelId: z.string().optional(),
  newChannelName: z.string().optional(),
  existingMode: z.enum(["IMPORT_ALL", "NEW_ONLY"]).default("IMPORT_ALL"),
  enabled: z.boolean().default(true),
});

function detectKind(url: string): "peertube" | "zone3s" {
  const u = url.toLowerCase();
  if (u.includes("peertube") || u.includes("/api/v1/") || u.includes("peertube3.")) return "peertube";
  return "zone3s";
}

function safePrefix(userId: string) {
  const ts = Date.now().toString(36);
  return `u${userId.slice(0, 6)}_${ts}`.slice(0, 40);
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const list = await prisma.apiSource.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      prefix: true,
      enabled: true,
      mappingJson: true,
      createdAt: true,
      updatedAt: true,
      channelId: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncError: true,
      channel: { select: { id: true, name: true, slug: true } },
    },
  });

  return Response.json({ ok: true, items: list });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const url = parsed.data.url.trim();
  const kind = parsed.data.kind ?? detectKind(url);
  const existingMode = parsed.data.existingMode;

  // Channel selection (optional)
  let channelId: string | null = null;
  if (parsed.data.channelId && parsed.data.channelId !== "__none__") {
    if (parsed.data.channelId === "__new__") {
      const nm = (parsed.data.newChannelName ?? "").trim().slice(0, 120);
      if (!nm) return Response.json({ ok: false, error: "NEW_CHANNEL_NAME_REQUIRED" }, { status: 400 });
      const slugBase = slugify(nm) || `channel-${userId.slice(0, 6)}`;
      const ch = await prisma.channel.upsert({
        where: { slug: slugBase },
        update: { name: nm },
        create: { name: nm, slug: slugBase, description: "" },
        select: { id: true },
      });
      channelId = ch.id;
    } else {
      const ch = await prisma.channel.findUnique({ where: { id: parsed.data.channelId }, select: { id: true } });
      if (!ch) return Response.json({ ok: false, error: "CHANNEL_NOT_FOUND" }, { status: 404 });
      channelId = ch.id;
    }
  }

  // Build mapping json for worker
  const mapping: any = {
    kind: kind === "peertube" ? "peertube" : "zone3s_posts",
    existingMode,
    assignToUserId: userId,
  };

  if (channelId) mapping.fixedChannelId = channelId;

  if (kind === "peertube") {
    // Expect user might paste a browse URL. Convert to a workable API URL if possible.
    // If they already provide an API URL, keep as-is.
    let baseUrl = url;
    if (!/\/api\/v1\/videos/i.test(baseUrl)) {
      try {
        const u = new URL(baseUrl);
        baseUrl = `${u.origin}/api/v1/videos?count=50&sort=-publishedAt`;
      } catch {
        // keep
      }
    }

    mapping.items = "data";
    mapping.id = "uuid";
    mapping.title = "name";
    mapping.description = "description";
    mapping.thumb = "thumbnailPath";
    mapping.hls = "streamingPlaylists.0.playlistUrl";
    mapping.durationSec = "duration";
    mapping.channelName = "channel.displayName";
    mapping.channelSlug = "channel.name";

    const src = await prisma.apiSource.create({
      data: {
        ownerId: userId,
        channelId,
        name: `PeerTube Sync`,
        prefix: safePrefix(userId),
        baseUrl,
        enabled: parsed.data.enabled,
        mappingJson: JSON.stringify(mapping),
      },
      select: { id: true },
    });
    return Response.json({ ok: true, id: src.id });
  }

  // zone3s
  mapping.items = "posts";
  mapping.id = "post_id";
  mapping.title = "post_title";
  mapping.description = "post_content";
  mapping.thumb = "post_thumbnail";
  mapping.hls = "post_stream";
  mapping.durationSec = "post_duration";

  const src = await prisma.apiSource.create({
    data: {
      ownerId: userId,
      channelId,
      name: `Zone3s Sync`,
      prefix: safePrefix(userId),
      baseUrl: url,
      enabled: parsed.data.enabled,
      mappingJson: JSON.stringify(mapping),
    },
    select: { id: true },
  });

  return Response.json({ ok: true, id: src.id });
}
