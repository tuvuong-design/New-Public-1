import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";
import { ContractsNotice } from "./ContractsNotice";

export const dynamic = "force-dynamic";

const CHAINS = ["SOLANA", "ETHEREUM", "POLYGON", "BSC", "BASE", "TRON"] as const;

export default async function AdminNftContractsPage() {
  const cfg = await getSiteConfig();
  const delayHours = Number((cfg as any).nftExportContractChangeDelayHours ?? 24);

  const rows = await prisma.nftChainContract.findMany({ orderBy: { chain: "asc" }, include: { pendingSetBy: { select: { id: true, name: true } } } });
  const byChain = new Map(rows.map((r) => [r.chain, r]));

  function placeholderForChain(chain: string) {
    if (chain === "SOLANA") return "Solana address (base58)";
    if (chain === "TRON") return "Tron address (T... or 41...)";
    return "0x...";
  }

  return (
    <div className="space-y-4">
      <ContractsNotice />
      <div className="card">
        <div className="text-lg font-semibold">NFT Chain Contracts</div>
        <div className="small muted">Đổi contract theo chain, có pending + delay {delayHours} giờ trước khi áp dụng.</div>
        <div className="small muted">Các NFTs đã export không bị ảnh hưởng: mỗi export request lưu contract tại thời điểm rút.</div>
      </div>

      {CHAINS.map((c) => {
        const r = byChain.get(c as any);
        const due = r?.pendingApplyAt ? (new Date(r.pendingApplyAt).getTime() <= Date.now()) : false;
        return (
          <div key={c} className={`card space-y-2 ${due ? "border border-yellow-500/40" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{c}</div>
              <div className="small muted">Current: <span className="font-mono">{r?.address || "(none)"}</span></div>
            </div>

            <div className="small muted">Pending: <span className="font-mono">{r?.pendingAddress || "(none)"}</span></div>
            {r?.pendingApplyAt ? (
              <div className="small muted">
                Apply at: {new Date(r.pendingApplyAt).toLocaleString()} (set by {r.pendingSetBy?.name || r.pendingSetById || "?"})
                {due ? <span className="ml-2 inline-block rounded bg-yellow-500/15 px-2 py-0.5 text-xs">DUE NOW</span> : null}
              </div>
            ) : null}

            <form action="/api/admin/nft/contracts" method="post" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="action" value="SET_PENDING" />
              <input type="hidden" name="chain" value={c} />
              <input name="address" className="input" placeholder={placeholderForChain(c)} style={{ minWidth: 340 }} />
              <button className="btn" type="submit">Set pending</button>
            </form>

            <form action="/api/admin/nft/contracts" method="post" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="action" value="APPLY_PENDING" />
              <input type="hidden" name="chain" value={c} />
              <button className="btn btn-ghost" type="submit">Apply pending (if due)</button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
