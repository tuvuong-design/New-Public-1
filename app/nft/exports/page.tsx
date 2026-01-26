import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseMintedRef(s: string | null | undefined) {
  if (!s) return { walletAddress: "", mintAddress: "" };
  try {
    const j = JSON.parse(s);
    if (j && typeof j === "object") {
      return {
        walletAddress: String((j as any).walletAddress ?? ""),
        mintAddress: String((j as any).mintAddress ?? ""),
      };
    }
  } catch {
    // ignore
  }
  // fallback: walletAddress=...
  const m = String(s).match(/walletAddress=([^\s]+)/);
  const m2 = String(s).match(/mintAddress=([^\s]+)/);
  return { walletAddress: m?.[1] || "", mintAddress: m2?.[1] || "" };
}

export default async function NftExportsPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const reqs = await prisma.nftExportRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      item: { select: { id: true, name: true, exportStatus: true, marketplaceFrozen: true } },
    },
  });

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="card">
        <div className="text-lg font-extrabold">NFT Exports</div>
        <div className="small muted">Theo dõi trạng thái export on-chain + tokenURI + tokenId.</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="btn" href="/nft">NFT Home</Link>
          <Link className="btn" href="/nft/market">NFT Market</Link>
        </div>
      </div>

      {reqs.length === 0 ? (
        <div className="card muted">Chưa có export request nào.</div>
      ) : (
        <div className="space-y-3">
          {reqs.map((r) => {
            const { walletAddress, mintAddress } = parseMintedRef(r.mintedRef);
            return (
              <div key={r.id} className="card">
                <div className="flex flex-wrap" style={{ gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div className="text-sm font-semibold">{r.item?.name || r.itemId}</div>
                    <div className="small muted">Chain: {r.chain} • Status: {r.status}</div>
                    {walletAddress ? <div className="small muted">Wallet: {walletAddress}</div> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link className="btn btn-ghost" href={`/nft/items/${r.itemId}`}>Item</Link>
                  </div>
                </div>

                <div className="small" style={{ marginTop: 10 }}>
                  Contract: <span className="font-mono">{r.contractAddress || "(pending)"}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>
                  TokenId: <span className="font-mono">{r.tokenIdHex || "(pending)"}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>
                  TokenURI: <span className="font-mono">{r.tokenUri || "(pending)"}</span>
                </div>

                {r.status === "READY" ? (
                  <div style={{ marginTop: 12 }}>
                    <div className="small muted">
                      Khi bạn đã mint thành công (bằng ví/tool của bạn), hãy dán <b>txHash</b> để hệ thống verify on-chain và chuyển NFT sang trạng thái EXPORTED.
                    </div>
                    <form action="/api/nft/export/submit-tx" method="post" className="flex flex-wrap" style={{ gap: 8, alignItems: "center", marginTop: 10 }}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <input name="txHash" className="input" placeholder={r.chain === "TRON" ? "txid..." : "0x..."} style={{ minWidth: 280 }} />
                      <button className="btn" type="submit">Submit tx</button>
                    </form>
                    {r.chain === "SOLANA" ? <div className="small muted" style={{ marginTop: 8 }}>Solana verify dựa trên delta token balance (auto-detect mintAddress).</div> : null}
                  </div>
                ) : null}

                {r.status === "FAILED" ? (
                  <div className="small" style={{ marginTop: 10 }}>
                    <span className="badge">FAILED</span> <span className="muted">Bạn có thể tạo request mới sau khi sửa cấu hình IPFS/contract.</span>
                  </div>
                ) : null}

                {r.status === "EXPORTED" ? (
                  <div className="small" style={{ marginTop: 10 }}>
                    <span className="badge">EXPORTED</span> <span className="muted">Marketplace nội bộ đã bị khóa.</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
