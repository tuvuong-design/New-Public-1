import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSiteConfig } from "@/lib/siteConfig";
import { getActiveMembershipTier } from "@/lib/membership";

export const dynamic = "force-dynamic";

export default async function NftMintPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const tier = getActiveMembershipTier((session.user as any) ?? {} as any);
  const cfg = await getSiteConfig();

  if (tier !== "PREMIUM_PLUS") {
    return (
      <main className="mx-auto max-w-2xl space-y-4">
        <div className="card">
          <div className="text-sm font-semibold">Mint NFT</div>
          <div className="small muted" style={{ marginTop: 8 }}>
            Tính năng mint NFT chỉ dành cho <b>Premium+</b>.
          </div>
          <div style={{ marginTop: 12 }}>
            <Link className="btn" href="/premium">
              Mua Premium+
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const minted = await prisma.nftItem.findMany({
    where: { videoId: { not: null }, collection: { creatorId: userId } },
    select: { videoId: true },
  });
  const mintedIds = new Set(minted.map((m) => m.videoId!).filter(Boolean));

  const videos = await prisma.video.findMany({
    where: {
      authorId: userId,
      status: "PUBLISHED",
      id: { notIn: Array.from(mintedIds) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, description: true, thumbKey: true },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <div className="card">
        <div className="text-sm font-semibold">Mint NFT từ video</div>
        <div className="small muted" style={{ marginTop: 8 }}>
          Phí mint: <b>{cfg.nftMintFeeStars}</b> stars / NFT.
        </div>
        <div className="small muted" style={{ marginTop: 4 }}>
          NFT sẽ được tạo dưới dạng "internal" trong hệ thống (không export on-chain ở bản này).
        </div>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        {videos.map((v) => (
          <div key={v.id} className="card">
            <div className="flex" style={{ alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-semibold truncate">{v.title}</div>
                <div className="small muted truncate">{v.description || ""}</div>
              </div>
              <div className="flex" style={{ gap: 8, alignItems: "center" }}>
                <Link className="btn btn-ghost" href={`/v/${v.id}`}>
                  Xem
                </Link>
                <form action="/api/nft/mint" method="post">
                  <input type="hidden" name="videoId" value={v.id} />
                  <button className="btn" type="submit">
                    Mint NFT
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}

        {videos.length === 0 ? (
          <div className="card muted">
            Không có video nào đủ điều kiện để mint (hoặc bạn đã mint hết).
          </div>
        ) : null}
      </div>
    </main>
  );
}
