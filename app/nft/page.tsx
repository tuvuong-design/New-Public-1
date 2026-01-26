import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function NftHomePage() {
  const items = await prisma.nftItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 24,
    include: {
      collection: {
        select: {
          id: true,
          title: true,
          creatorId: true,
          creator: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, name: true } },
      video: { select: { id: true, title: true } },
    },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">NFT</div>
        <div className="small muted">
          NFT nội bộ (INTERNAL) — Mint chỉ dành cho Premium+ (tính phí stars). Bạn có thể dùng NFT làm avatar và trưng bày trong kênh.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="btn" href="/nft/market">
            NFT Market
          </Link>

          <Link className="btn" href="/nft/mint">
            Mint NFT
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="text-sm font-semibold">Mới mint</div>
        {items.length === 0 ? (
          <div className="small muted">Chưa có NFT nào.</div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {items.map((it) => {
              const img = it.imageKey ? `${env.R2_PUBLIC_BASE_URL}/${it.imageKey}` : null;
              return (
                <div key={it.id} className="card" style={{ padding: 10 }}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={it.name} className="w-full rounded" />
                  ) : (
                    <div className="w-full rounded bg-zinc-900" style={{ aspectRatio: "1/1" }} />
                  )}
                  <div className="mt-2 text-sm font-semibold line-clamp-2">{it.name}</div>
                  <div className="small muted">
                    by{" "}
                    <Link className="underline" href={`/u/${it.collection.creatorId}`}>
                      {it.collection.creator?.name || "Unknown"}
                    </Link>
                  </div>
                  <div className="small muted">
                    Owner:{" "}
                    <Link className="underline" href={`/u/${it.ownerId}`}>
                      {it.owner?.name || "Unknown"}
                    </Link>
                  </div>
                  {it.videoId ? (
                    <div className="small" style={{ marginTop: 6 }}>
                      <Link className="underline" href={`/v/${it.videoId}`}>
                        Xem video
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
