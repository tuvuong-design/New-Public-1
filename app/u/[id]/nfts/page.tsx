import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function UserNftsPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;
  const isSelf = viewerId === params.id;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, avatarNftItemId: true },
  });
  if (!user) {
    return (
      <main className="mx-auto max-w-2xl space-y-4">
        <div className="card">Không tìm thấy user</div>
      </main>
    );
  }

  const items = await prisma.nftItem.findMany({
    where: { OR: [{ ownerId: params.id }, { collection: { creatorId: params.id } }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      collection: { select: { id: true, title: true } },
      video: { select: { id: true, title: true } },
    },
  });

  return (
    <main className="space-y-3">
      <div className="card">
        <div className="text-sm font-semibold">NFTs</div>
        <div className="small muted">
          {items.length} item{items.length === 1 ? "" : "s"}
        </div>
        {isSelf ? (
          <div className="small muted" style={{ marginTop: 8 }}>
            Premium+ có quyền mint NFT. Nếu bạn chưa có, hãy vào trang{" "}
            <Link className="underline" href="/premium">
              Premium
            </Link>
            .
          </div>
        ) : null}
        {isSelf ? (
          <div style={{ marginTop: 10 }}>
            <Link className="btn" href="/nft/mint">
              Mint NFT từ video
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid" style={{ gap: 12 }}>
        {items.map((it) => {
          const img = it.imageKey ? `${env.R2_PUBLIC_BASE_URL}/${it.imageKey}` : null;
          const isAvatar = user.avatarNftItemId === it.id;
          const canSetAvatar = isSelf && it.ownerId === user.id;

          return (
            <div key={it.id} className="card">
              <div className="flex" style={{ gap: 12, alignItems: "center" }}>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={it.name} className="rounded" style={{ width: 64, height: 64, objectFit: "cover" }} />
                ) : (
                  <div className="rounded bg-zinc-200 dark:bg-zinc-800" style={{ width: 64, height: 64 }} />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-semibold" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="truncate">{it.name}</span>
                    {isAvatar ? <span className="badge">Avatar</span> : null}
                  </div>
                  <div className="small muted">
                    Bộ sưu tập: {it.collection?.title || "(không có)"}
                  </div>
                  {it.video ? (
                    <div className="small">
                      Nguồn: <Link className="underline" href={`/v/${it.video.id}`}>
                        {it.video.title}
                      </Link>
                    </div>
                  ) : null}
                </div>

                {canSetAvatar ? (
                  <form action="/api/nft/avatar" method="post">
                    <input type="hidden" name="nftItemId" value={it.id} />
                    <button className="btn" type="submit">
                      Đặt làm avatar
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}

        {items.length === 0 ? <div className="card muted">Chưa có NFT nào.</div> : null}
      </div>
    </main>
  );
}
