import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function NftMarketPage() {
  const listings = await prisma.nftListing.findMany({
    where: { status: "ACTIVE", item: { exportStatus: "NONE", marketplaceFrozen: false } },
    orderBy: { createdAt: "desc" },
    take: 48,
    include: {
      seller: { select: { id: true, name: true } },
      item: {
        include: {
          collection: { select: { id: true, title: true, creatorId: true, creator: { select: { id: true, name: true } } } },
          owner: { select: { id: true, name: true } },
          video: { select: { id: true, title: true } },
        },
      },
    },
  });

  const auctions = await prisma.nftAuction.findMany({
    where: { status: "ACTIVE", endAt: { gt: new Date() }, item: { exportStatus: "NONE", marketplaceFrozen: false } },
    orderBy: { endAt: "asc" },
    take: 48,
    include: {
      seller: { select: { id: true, name: true } },
      highestBid: { select: { amountStars: true } },
      item: {
        include: {
          collection: { select: { id: true, title: true, creatorId: true, creator: { select: { id: true, name: true } } } },
          owner: { select: { id: true, name: true } },
          video: { select: { id: true, title: true } },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">NFT Market</div>
        <div className="small muted">Chợ NFT nội bộ (INTERNAL) — mua/bán bằng Stars.</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="btn" href="/nft">
            NFT Home
          </Link>
          <Link className="btn" href="/nft/mint">
            Mint NFT
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="text-sm font-semibold">Listings đang bán</div>
        {listings.length === 0 ? (
          <div className="small muted">Chưa có listing nào.</div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {listings.map((l) => {
              const it = l.item;
              const img = it.imageKey ? `${env.R2_PUBLIC_BASE_URL}/${it.imageKey}` : null;
              return (
                <Link key={l.id} href={`/nft/items/${it.id}`} className="card" style={{ padding: 10, display: "block" }}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={it.name} className="w-full rounded" />
                  ) : (
                    <div className="w-full rounded bg-zinc-900" style={{ aspectRatio: "1/1" }} />
                  )}
                  <div className="mt-2 text-sm font-semibold line-clamp-2">{it.name}</div>
                  <div className="small muted">
                    Price: <span className="font-semibold">{l.priceStars}</span> ★
                  </div>
                  <div className="small muted">Seller: {l.seller?.name || "Unknown"}</div>
                  {it.videoId ? (
                    <div className="small" style={{ marginTop: 6 }}>
                      <span className="underline">Xem video</span>
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="text-sm font-semibold">Auctions đang đấu giá</div>
        {auctions.length === 0 ? (
          <div className="small muted">Chưa có auction nào.</div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {auctions.map((a) => {
              const it = a.item;
              const img = it.imageKey ? `${env.R2_PUBLIC_BASE_URL}/${it.imageKey}` : null;
              const current = a.highestBid?.amountStars ?? a.startPriceStars;
              return (
                <Link key={a.id} href={`/nft/items/${it.id}`} className="card" style={{ padding: 10, display: "block" }}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={it.name} className="w-full rounded" />
                  ) : (
                    <div className="w-full rounded bg-zinc-900" style={{ aspectRatio: "1/1" }} />
                  )}
                  <div className="mt-2 text-sm font-semibold line-clamp-2">{it.name}</div>
                  <div className="small muted">
                    Current: <span className="font-semibold">{current}</span> ★
                  </div>
                  <div className="small muted">Ends: {new Date(a.endAt).toLocaleString()}</div>
                  <div className="small muted">Seller: {a.seller?.name || "Unknown"}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
