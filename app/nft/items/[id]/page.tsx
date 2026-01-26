import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth";
import { getSiteConfig } from "@/lib/siteConfig";
import { getEvmNftOwnerCached, getTronNftOwnerCached } from "@/lib/nft/onChainOwner";

export const dynamic = "force-dynamic";

export default async function NftItemPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;

  const item = await prisma.nftItem.findUnique({
    where: { id: params.id },
    include: {
      collection: { select: { id: true, title: true, creatorId: true, royaltyBps: true, creatorRoyaltySharePct: true, creator: { select: { id: true, name: true } } } },
      owner: { select: { id: true, name: true, avatarNftItemId: true } },
      video: { select: { id: true, title: true, authorId: true } },
      listings: { where: { status: "ACTIVE" }, take: 1, orderBy: { createdAt: "desc" } },
      auctions: { where: { status: "ACTIVE" }, take: 1, orderBy: { createdAt: "desc" }, include: { highestBid: { select: { amountStars: true, bidderId: true } } } },
      exportRequests: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!item) {
    return (
      <main className="mx-auto max-w-2xl space-y-4">
        <div className="card">Không tìm thấy NFT.</div>
        <Link className="btn" href="/nft/market">
          Về chợ NFT
        </Link>
      </main>
    );
  }

  const activeListing = item.listings?.[0] || null;
  const activeAuction = (item as any).auctions?.[0] || null;
  const isOwner = viewerId && viewerId === item.ownerId;

  const viewer = viewerId
    ? await prisma.user.findUnique({ where: { id: viewerId }, select: { id: true, starBalance: true } })
    : null;

  const img = item.imageKey ? `${env.R2_PUBLIC_BASE_URL}/${item.imageKey}` : null;

  const royaltyPct = (Number(item.collection.royaltyBps) || 0) / 100;

  const cfg = await getSiteConfig();
  const mirrorMode = String((cfg as any).nftExportMirrorMode || "READ_ONLY");
  const lastExport = (item as any).exportRequests?.[0] || null;
  let onChainOwner: string | null = null;
  if (mirrorMode === "MIRROR" && item.exportStatus === "EXPORTED" && lastExport?.contractAddress && lastExport?.tokenIdHex) {
    const chain = String(lastExport.chain || item.exportChain || "");
    const evmChains = new Set(["ETHEREUM", "POLYGON", "BSC", "BASE"]);
    if (evmChains.has(chain.toUpperCase())) {
      try {
        const owner = await getEvmNftOwnerCached({ chain, contractAddress: lastExport.contractAddress, tokenIdHex: lastExport.tokenIdHex });
        onChainOwner = owner || null;
      } catch {
        onChainOwner = null;
      }
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="card">
        <div className="flex" style={{ gap: 12, alignItems: "center" }}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={item.name} className="rounded" style={{ width: 96, height: 96, objectFit: "cover" }} />
          ) : (
            <div className="rounded bg-zinc-200 dark:bg-zinc-800" style={{ width: 96, height: 96 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="text-lg font-extrabold" style={{ lineHeight: 1.2 }}>
              {item.name}
            </div>
            <div className="small muted">Collection: {item.collection.title}</div>
            <div className="small muted">
              Creator: <Link className="underline" href={`/u/${item.collection.creatorId}`}>{item.collection.creator?.name || "Unknown"}</Link>
            </div>
            <div className="small muted">
              Owner: <Link className="underline" href={`/u/${item.ownerId}`}>{item.owner?.name || "Unknown"}</Link>
            </div>
            <div className="small muted">Verification: {item.verificationStatus}</div>
            <div className="small muted">
              Royalty: {royaltyPct.toFixed(2)}% (creator share {item.collection.creatorRoyaltySharePct}%)
            </div>
            {item.exportStatus !== "NONE" && lastExport ? (
              <div className="small muted" style={{ marginTop: 6 }}>
                Export: <span className="badge">{String(item.exportStatus)}</span> {String(lastExport.chain)}
                {lastExport.contractAddress ? <span className="muted"> · contract {String(lastExport.contractAddress).slice(0, 10)}…</span> : null}
                {lastExport.tokenIdHex ? <span className="muted"> · tokenId {String(lastExport.tokenIdHex).slice(0, 10)}…</span> : null}
              </div>
            ) : null}
            {mirrorMode === "MIRROR" && item.exportStatus === "EXPORTED" ? (
              <div className="small muted">
                On-chain owner: <span className="font-mono">{onChainOwner || "(unknown)"}</span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col" style={{ gap: 8 }}>
            <Link className="btn" href="/nft/market">Chợ NFT</Link>
            <Link className="btn" href="/nft">NFT Home</Link>
          </div>
        </div>

        {item.videoId ? (
          <div className="small" style={{ marginTop: 10 }}>
            Video: <Link className="underline" href={`/v/${item.videoId}`}>{item.video?.title || item.videoId}</Link>
          </div>
        ) : null}

        {item.marketplaceFrozen || item.exportStatus !== "NONE" ? (
          <div className="small" style={{ marginTop: 10 }}>
            <span className="badge">Frozen</span> <span className="muted">Marketplace bị khóa do export ({item.exportStatus}).</span>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="text-sm font-semibold">Marketplace</div>
        {activeListing ? (
          <div className="space-y-2" style={{ marginTop: 10 }}>
            <div className="small">
              Listing: <span className="badge">ACTIVE</span> Price <span className="font-semibold">{activeListing.priceStars}</span> ★
            </div>

            {viewerId ? (
              <div className="small muted">Your balance: {viewer?.starBalance ?? 0} ★</div>
            ) : (
              <div className="small muted">Đăng nhập để mua.</div>
            )}

            {isOwner ? (
              <form action={`/api/nft/listings/${activeListing.id}/cancel`} method="post">
                <input type="hidden" name="back" value={`/nft/items/${item.id}`} />
                <button className="btn" type="submit">Huỷ listing</button>
              </form>
            ) : viewerId ? (
              <form action={`/api/nft/listings/${activeListing.id}/buy`} method="post">
                <input type="hidden" name="back" value={`/nft/items/${item.id}`} />
                <button className="btn" type="submit" disabled={(viewer?.starBalance ?? 0) < Number(activeListing.priceStars)}>
                  Mua ngay ({activeListing.priceStars} ★)
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          <div className="small muted" style={{ marginTop: 10 }}>
            Chưa có listing đang bán.
          </div>
        )}

        {isOwner && !activeListing && !item.marketplaceFrozen && item.exportStatus === "NONE" ? (
          <div style={{ marginTop: 14 }}>
            <div className="small muted">Tạo listing (không mất phí niêm yết)</div>
            <form action="/api/nft/listings/create" method="post" className="flex" style={{ gap: 8, alignItems: "center", marginTop: 8 }}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="back" value={`/nft/items/${item.id}`} />
              <input
                name="priceStars"
                type="number"
                min={1}
                step={1}
                placeholder="Giá (stars)"
                className="input"
                style={{ maxWidth: 200 }}
              />
              <button className="btn" type="submit">Đăng bán</button>
            </form>
          </div>
        ) : null}

        {!activeListing && activeAuction ? (
          <div className="space-y-2" style={{ marginTop: 14 }}>
            <div className="small">
              Auction: <span className="badge">ACTIVE</span> Ends <span className="font-semibold">{new Date(activeAuction.endAt).toLocaleString()}</span>
            </div>
            <div className="small">
              Current bid: <span className="font-semibold">{activeAuction.highestBid?.amountStars ?? activeAuction.startPriceStars}</span> ★
            </div>

            {viewerId ? (
              <div className="small muted">Your balance: {viewer?.starBalance ?? 0} ★</div>
            ) : (
              <div className="small muted">Đăng nhập để đặt giá.</div>
            )}

            {isOwner ? (
              <div className="flex flex-wrap gap-2">
                <form action={`/api/nft/auctions/${activeAuction.id}/cancel`} method="post">
                  <input type="hidden" name="back" value={`/nft/items/${item.id}`} />
                  <button className="btn btn-ghost" type="submit">Huỷ auction (nếu chưa có bid)</button>
                </form>
                <form action={`/api/nft/auctions/${activeAuction.id}/settle`} method="post">
                  <input type="hidden" name="back" value={`/nft/items/${item.id}`} />
                  <button className="btn" type="submit">Settle</button>
                </form>
              </div>
            ) : viewerId ? (
              <form action={`/api/nft/auctions/${activeAuction.id}/bid`} method="post" className="flex" style={{ gap: 8, alignItems: "center" }}>
                <input type="hidden" name="back" value={`/nft/items/${item.id}`} />
                <input
                  name="amountStars"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Bid (stars)"
                  className="input"
                  style={{ maxWidth: 200 }}
                />
                <button className="btn" type="submit">Đặt giá</button>
              </form>
            ) : null}
          </div>
        ) : null}

        {isOwner && !activeListing && !activeAuction && !item.marketplaceFrozen && item.exportStatus === "NONE" ? (
          <div style={{ marginTop: 14 }}>
            <div className="small muted">Tạo auction</div>
            <form action="/api/nft/auctions/create" method="post" className="flex flex-wrap" style={{ gap: 8, alignItems: "center", marginTop: 8 }}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="back" value={`/nft/items/${item.id}`} />
              <input name="startPriceStars" type="number" min={1} step={1} placeholder="Start price" className="input" style={{ maxWidth: 140 }} />
              <input name="reservePriceStars" type="number" min={0} step={1} placeholder="Reserve (optional)" className="input" style={{ maxWidth: 160 }} />
              <input name="durationHours" type="number" min={1} max={168} step={1} placeholder="Duration (hours)" className="input" style={{ maxWidth: 160 }} />
              <button className="btn" type="submit">Bắt đầu đấu giá</button>
            </form>
          </div>
        ) : null}
      </div>

      {isOwner && !activeListing && !activeAuction && !item.marketplaceFrozen && item.exportStatus === "NONE" ? (
        <div className="card">
          <div className="text-sm font-semibold">Export on-chain</div>
          <div className="small muted" style={{ marginTop: 8 }}>
            Xuất NFT ra blockchain sẽ khóa marketplace nội bộ ngay khi request (PENDING). Bạn cần kết thúc đấu giá / hủy listing trước khi export.
          </div>
          <form action="/api/nft/export/request" method="post" className="grid" style={{ gap: 8, marginTop: 10, maxWidth: 520 }}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="back" value={`/nft/items/${item.id}`} />
            <label className="small">Chain</label>
            <select name="chain" className="input">
              <option value="POLYGON">Polygon (primary)</option>
              <option value="SOLANA">Solana (beta)</option>
              <option value="TRON">TRON (beta)</option>
              <option value="BSC">BSC</option>
              <option value="ETHEREUM">Ethereum</option>
              <option value="BASE">Base</option>
            </select>
            <label className="small">Metadata strategy</label>
            <select name="metadataStrategy" className="input">
              <option value="PUBLIC_URL">animation_url = public URL (nhanh, nhẹ)</option>
              <option value="IPFS_MEDIA">Upload media to IPFS (nặng, tốn phí)</option>
            </select>
            <label className="small">Wallet address nhận NFT</label>
            <input name="walletAddress" className="input" placeholder="0x... / Solana address / Tron (T... or 41...)" />
            <label className="small flex" style={{ gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="includeVideoInIpfs" value="1" />
              <span>Include video in IPFS (nếu chọn IPFS)</span>
            </label>
            <button className="btn" type="submit">Tạo export request</button>
          </form>
          <div className="small" style={{ marginTop: 10 }}>
            <Link className="underline" href="/nft/exports">Xem export requests</Link>
          </div>
        </div>
      ) : null}

      {isOwner ? (
        <div className="card">
          <div className="text-sm font-semibold">Avatar</div>
          <div className="small muted" style={{ marginTop: 8 }}>
            Bạn có thể dùng NFT này làm avatar.
          </div>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
            <form action="/api/nft/avatar" method="post">
              <input type="hidden" name="nftItemId" value={item.id} />
              <input type="hidden" name="back" value={`/nft/items/${item.id}`} />
              <button className="btn" type="submit">Đặt làm avatar</button>
            </form>
            <form action="/api/nft/avatar" method="post">
              <input type="hidden" name="clear" value="1" />
              <input type="hidden" name="back" value={`/nft/items/${item.id}`} />
              <button className="btn" type="submit">Bỏ avatar</button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="text-sm font-semibold">Mô tả</div>
        <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{item.description || "(trống)"}</div>
      </div>
    </main>
  );
}
