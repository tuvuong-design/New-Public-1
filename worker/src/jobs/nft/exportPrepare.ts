import { prisma } from "../../prisma";
import { env } from "../../env";

const MAX_MEDIA_BYTES = 200 * 1024 * 1024; // 200MB safeguard

function safeParseJson(raw: string | null | undefined): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function uploadBytesToNftStorage(args: { bytes: Uint8Array; contentType: string }): Promise<string> {
  if (!env.NFT_STORAGE_API_KEY) throw new Error("NFT_STORAGE_API_KEY_MISSING");
  const res = await fetch("https://api.nft.storage/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NFT_STORAGE_API_KEY}`,
      "Content-Type": args.contentType || "application/octet-stream",
    },
    body: args.bytes,
  });
  const j = (await res.json().catch(() => null)) as any;
  if (!res.ok || !j?.ok || !j?.value?.cid) {
    throw new Error(`NFT_STORAGE_UPLOAD_FAILED:${res.status}`);
  }
  const cid = String(j.value.cid);
  return `ipfs://${cid}`;
}

async function fetchAsBytes(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FETCH_FAILED:${res.status}`);
  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  return { bytes, contentType };
}

async function uploadJsonToNftStorage(obj: any): Promise<string> {
  if (!env.NFT_STORAGE_API_KEY) throw new Error("NFT_STORAGE_API_KEY_MISSING");
  const res = await fetch("https://api.nft.storage/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NFT_STORAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(obj),
  });
  const j = await res.json().catch(() => null) as any;
  if (!res.ok || !j?.ok || !j?.value?.cid) {
    throw new Error(`NFT_STORAGE_UPLOAD_FAILED:${res.status}`);
  }
  const cid = String(j.value.cid);
  return `ipfs://${cid}`;
}

export async function nftExportPrepareJob(exportRequestId: string) {
  const req = await prisma.nftExportRequest.findUnique({
    where: { id: exportRequestId },
    include: {
      item: {
        include: {
          collection: { include: { creator: { select: { id: true, name: true } } } },
          video: { select: { id: true, title: true } },
        },
      },
      user: { select: { id: true, name: true } },
    },
  });
  if (!req) throw new Error("EXPORT_REQUEST_NOT_FOUND");
  if (req.status !== "PENDING") return { ok: true, skipped: true };
  if (!req.item) throw new Error("ITEM_NOT_FOUND");

  const item = req.item;
  const name = item.name;
  const description = item.description;

  let image: string | undefined = item.imageKey ? `${env.R2_PUBLIC_BASE_URL}/${item.imageKey}` : undefined;

  // animation_url strategy
  let animation_url: string | undefined = undefined;
  if (item.animationUrl) animation_url = item.animationUrl;
  else if (item.videoId) animation_url = `${env.SITE_URL}/v/${item.videoId}`;

  // Optional media upload (IPFS_MEDIA). This can be expensive; charge by GB (stars) and has a size safeguard.
  let uploadedBytesTotal = 0;
  if (req.metadataStrategy === "IPFS_MEDIA") {
    try {
      if (env.NFT_STORAGE_PROVIDER !== "NFT_STORAGE") {
        throw new Error("IPFS_PROVIDER_UNSUPPORTED");
      }

      // Upload image if present.
      if (image && image.startsWith("http")) {
        const { bytes, contentType } = await fetchAsBytes(image);
        if (bytes.length <= MAX_MEDIA_BYTES) {
          const ipfs = await uploadBytesToNftStorage({ bytes, contentType });
          image = ipfs;
          uploadedBytesTotal += bytes.length;
        } else {
          await prisma.nftEventLog.create({
            data: { actorId: req.userId, action: "NFT_EXPORT_MEDIA_SKIPPED_TOO_LARGE", dataJson: JSON.stringify({ exportRequestId: req.id, url: image, bytes: bytes.length }) },
          });
        }
      }

      // Upload video only if explicitly requested AND animation_url looks like a direct media file.
      if (req.includeVideoInIpfs && animation_url && animation_url.startsWith("http") && !animation_url.includes(`${env.SITE_URL}/v/`)) {
        const { bytes, contentType } = await fetchAsBytes(animation_url);
        const isVideo = contentType.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(animation_url);
        if (isVideo && bytes.length <= MAX_MEDIA_BYTES) {
          const ipfs = await uploadBytesToNftStorage({ bytes, contentType: contentType || "video/mp4" });
          animation_url = ipfs;
          uploadedBytesTotal += bytes.length;
        } else {
          await prisma.nftEventLog.create({
            data: { actorId: req.userId, action: "NFT_EXPORT_VIDEO_SKIPPED", dataJson: JSON.stringify({ exportRequestId: req.id, url: animation_url, bytes: bytes.length, contentType }) },
          });
        }
      }

      // Charge upload fee by GB (proportional, rounded up).
      const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { nftExportUploadMediaFeePerGbStars: true } });
      const feePerGb = Number(cfg?.nftExportUploadMediaFeePerGbStars ?? 0);
      if (feePerGb > 0 && uploadedBytesTotal > 0) {
        const gb = uploadedBytesTotal / (1024 * 1024 * 1024);
        const feeStars = Math.max(1, Math.ceil(gb * feePerGb));
        await prisma.$transaction(async (tx) => {
          const u = await tx.user.findUnique({ where: { id: req.userId }, select: { starBalance: true } });
          if (!u) throw new Error("USER_NOT_FOUND");
          if ((u.starBalance ?? 0) < feeStars) throw new Error("INSUFFICIENT_STARS_FOR_MEDIA_UPLOAD");
          await tx.user.update({ where: { id: req.userId }, data: { starBalance: { decrement: feeStars } } });
          await tx.starTransaction.create({
            data: { userId: req.userId, type: "NFT_EXPORT", delta: -feeStars, stars: feeStars, quantity: 1, note: `NFT export media upload fee (${uploadedBytesTotal} bytes)` },
          });
          await tx.nftEventLog.create({
            data: { actorId: req.userId, action: "NFT_EXPORT_MEDIA_FEE_CHARGED", dataJson: JSON.stringify({ exportRequestId: req.id, uploadedBytesTotal, feeStars, feePerGb }) },
          });
        });
      }
    } catch (e: any) {
      // Fail the export request (and unfreeze item) if IPFS_MEDIA was selected but we cannot prepare.
      await prisma.$transaction(async (tx) => {
        const base = safeParseJson(req.mintedRef) || {};
        await tx.nftExportRequest.update({ where: { id: req.id }, data: { status: "FAILED", mintedRef: JSON.stringify({ ...base, error: String(e?.message || e) }) } });
        await tx.nftItem.update({ where: { id: req.itemId }, data: { exportStatus: "NONE", exportChain: null, marketplaceFrozen: false } });
        await tx.nftEventLog.create({
          data: { actorId: req.userId, action: "NFT_EXPORT_PREPARE_FAILED", dataJson: JSON.stringify({ exportRequestId: req.id, error: String(e?.message || e) }) },
        });
      });
      return { ok: false, failed: true, error: String(e?.message || e) };
    }
  }

  const metadata = {
    name,
    description,
    image,
    animation_url,
    external_url: item.videoId ? `${env.SITE_URL}/v/${item.videoId}` : `${env.SITE_URL}/nft/items/${item.id}`,
    attributes: [
      { trait_type: "collection", value: item.collection.title },
      { trait_type: "creator", value: item.collection.creator?.name || item.collection.creatorId },
      { trait_type: "itemId", value: item.id },
      ...(item.videoId ? [{ trait_type: "videoId", value: item.videoId }] : []),
      { trait_type: "exportChain", value: req.chain },
    ],
  };

  const tokenUri = await uploadJsonToNftStorage(metadata);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.nftExportRequest.updateMany({
      where: { id: req.id, status: "PENDING" },
      data: { tokenUri, status: "READY" },
    });
    if (updated.count !== 1) return;

    await tx.nftEventLog.create({
      data: {
        actorId: req.userId,
        action: "NFT_EXPORT_METADATA_READY",
        dataJson: JSON.stringify({ exportRequestId: req.id, tokenUri }),
      },
    });
  });

  return { ok: true, tokenUri };
}
