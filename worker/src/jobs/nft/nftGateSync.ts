import { prisma } from "../../prisma";
import { env } from "../../env";
import { ethers } from "ethers";

type Addr = { chain: string; address: string };

function uniq<T>(arr: T[], key: (x: T) => string) {
  const m = new Map<string, T>();
  for (const x of arr) m.set(key(x), x);
  return [...m.values()];
}

function normalizeEvm(addr: string) {
  return String(addr || "").toLowerCase();
}

async function fetchSolanaTokenAccounts(owner: string) {
  if (!env.SOLANA_RPC_URL) return new Map<string, number>();

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountsByOwner",
    params: [
      owner,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ],
  };

  const res = await fetch(env.SOLANA_RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json: any = await res.json().catch(() => ({}));
  const out = new Map<string, number>();
  const list = json?.result?.value || [];
  for (const it of list) {
    const mint = it?.account?.data?.parsed?.info?.mint;
    const amount = Number(it?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0);
    if (mint && Number.isFinite(amount) && amount > 0) out.set(String(mint), Math.floor(amount));
  }
  return out;
}

function evmRpcUrl(chain: string) {
  const c = String(chain || "").toUpperCase();
  if (c === "ETHEREUM") return env.EVM_RPC_URL_ETHEREUM;
  if (c === "POLYGON") return env.EVM_RPC_URL_POLYGON;
  if (c === "BSC") return env.EVM_RPC_URL_BSC;
  if (c === "BASE") return env.EVM_RPC_URL_BASE;
  return "";
}

const ERC721_ABI = ["function balanceOf(address owner) view returns (uint256)"];

async function fetchEvmBalances(chain: string, owner: string, contracts: string[]) {
  const url = evmRpcUrl(chain);
  if (!url) return new Map<string, number>();
  const provider = new ethers.JsonRpcProvider(url);
  const out = new Map<string, number>();
  for (const c of contracts) {
    try {
      const addr = normalizeEvm(c);
      const contract = new ethers.Contract(addr, ERC721_ABI, provider);
      const bal = await contract.balanceOf(owner);
      const n = Number(bal?.toString?.() ?? "0");
      out.set(addr, Number.isFinite(n) ? Math.floor(n) : 0);
    } catch {
      out.set(normalizeEvm(c), 0);
    }
  }
  return out;
}

function tierRank(t: string) {
  if (t === "GOLD") return 3;
  if (t === "SILVER") return 2;
  return 1;
}

export async function nftGateSyncJob(data: { addresses?: Addr[]; reason?: string }) {
  let addresses = uniq((data.addresses || []).map((a) => ({ chain: String(a.chain || "").toUpperCase(), address: String(a.address || "") })), (x) => `${x.chain}:${x.address}`);
  if (addresses.length === 0) {
    const wallets = await prisma.userWallet.findMany({ where: { verifiedAt: { not: null } }, orderBy: { updatedAt: "desc" }, take: 200, select: { chain: true, address: true } });
    for (const w of wallets) addresses.push({ chain: String(w.chain).toUpperCase(), address: String(w.address) });
  }
  if (addresses.length === 0) return { ok: true, processed: 0 };

  const site = await prisma.siteConfig.findFirst({ orderBy: { createdAt: "asc" } });
  const flags = {
    nftGatedMembershipEnabled: Boolean((site as any)?.nftGatedMembershipEnabled),
    nftPremiumUnlockEnabled: Boolean((site as any)?.nftPremiumUnlockEnabled),
    creatorPassEnabled: Boolean((site as any)?.creatorPassEnabled),
  };

  // Fetch rules/gates/pass configs once
  const [rules, videoGates, passCfgs] = await Promise.all([
    prisma.nftGateRule.findMany({ where: { enabled: true } }),
    prisma.videoNftGate.findMany({ where: { enabled: true } }),
    prisma.creatorPassConfig.findMany({ where: { enabled: true } }),
  ]);

  const neededKeysByChain = new Map<string, Set<string>>();
  function addKey(chain: string, key?: string | null) {
    if (!key) return;
    const c = String(chain || "").toUpperCase();
    const set = neededKeysByChain.get(c) ?? new Set<string>();
    set.add(c === "SOLANA" ? String(key) : normalizeEvm(String(key)));
    neededKeysByChain.set(c, set);
  }

  if (flags.nftGatedMembershipEnabled) {
    for (const r of rules) {
      addKey(r.chain as any, (r as any).collectionAddress);
      addKey(r.chain as any, (r as any).tokenMint);
    }
  }
  if (flags.nftPremiumUnlockEnabled) {
    for (const g of videoGates) {
      addKey(g.chain as any, (g as any).collectionAddress);
      addKey(g.chain as any, (g as any).tokenMint);
    }
  }
  if (flags.creatorPassEnabled) {
    for (const c of passCfgs) addKey(c.chain as any, (c as any).collectionAddress);
  }

  for (const a of addresses) {
    const wallet = await prisma.userWallet.findUnique({
      where: { chain_address: { chain: a.chain as any, address: a.chain === "SOLANA" ? a.address : normalizeEvm(a.address) } },
      include: { user: { select: { id: true } } },
    });
    if (!wallet?.userId || !wallet.verifiedAt) continue;

    const needed = [...(neededKeysByChain.get(a.chain) ?? new Set<string>())];
    // If no gating enabled, still keep a minimal sync for UX (do nothing).
    if (needed.length === 0) continue;

    if (a.chain === "SOLANA") {
      const accounts = await fetchSolanaTokenAccounts(a.address);
      for (const key of needed) {
        const bal = accounts.get(key) ?? 0;
        await prisma.userWalletAsset.upsert({
          where: { walletId_assetKey: { walletId: wallet.id, assetKey: key } },
          update: { chain: "SOLANA" as any, kind: "TOKEN_MINT", balance: bal, lastSyncAt: new Date() },
          create: { walletId: wallet.id, chain: "SOLANA" as any, assetKey: key, kind: "TOKEN_MINT", balance: bal, lastSyncAt: new Date() },
        });
      }
    } else {
      const balances = await fetchEvmBalances(a.chain, a.address, needed);
      for (const key of needed) {
        const k = normalizeEvm(key);
        const bal = balances.get(k) ?? 0;
        await prisma.userWalletAsset.upsert({
          where: { walletId_assetKey: { walletId: wallet.id, assetKey: k } },
          update: { chain: a.chain as any, kind: "COLLECTION", balance: bal, lastSyncAt: new Date() },
          create: { walletId: wallet.id, chain: a.chain as any, assetKey: k, kind: "COLLECTION", balance: bal, lastSyncAt: new Date() },
        });
      }
    }

    // Apply memberships for this user
    if (flags.nftGatedMembershipEnabled) {
      const userId = wallet.userId;

      const userWallets = await prisma.userWallet.findMany({
        where: { userId, verifiedAt: { not: null } },
        select: { chain: true, assets: { select: { assetKey: true, balance: true } } },
      });

      const satisfied = rules.filter((r) => {
        const keys = [ (r as any).collectionAddress, (r as any).tokenMint ].filter(Boolean).map((x) => String(x));
        if (keys.length === 0) return false;
        return userWallets.some((w) =>
          String(w.chain) === String(r.chain) &&
          w.assets.some((a) => a.balance >= (r as any).minBalance && keys.some((k) => (String(a.assetKey) === k) || (String(a.assetKey).toLowerCase() === String(k).toLowerCase())))
        );
      });

      // Group by creatorId choose highest tier
      const best = new Map<string, any>();
      for (const r of satisfied) {
        const cur = best.get(r.creatorId);
        if (!cur || tierRank((r as any).mapsToTier) > tierRank((cur as any).mapsToTier)) best.set(r.creatorId, r);
      }

      // Paid membership guard
      const paidActive = await prisma.creatorMembership.findMany({
        where: { userId, status: "ACTIVE", source: "PAID", expiresAt: { gt: new Date() } },
        select: { plan: { select: { userId: true } } },
      });
      const paidCreators = new Set(paidActive.map((m) => (m.plan as any)?.userId).filter(Boolean));

      // Lapse old NFT_GATE memberships for creators touched by rules but not satisfied
      const creatorsWithRules = new Set(rules.map((r) => r.creatorId));
      const creatorsToConsider = [...creatorsWithRules];
      const allowedCreators = new Set(best.keys());

      for (const creatorId of creatorsToConsider) {
        if (allowedCreators.has(creatorId)) continue;
        await prisma.creatorMembership.updateMany({
          where: {
            userId,
            source: "NFT_GATE",
            status: "ACTIVE",
            plan: { userId: creatorId },
          },
          data: { status: "LAPSED", expiresAt: new Date() },
        });
      }

      for (const [creatorId, r] of best.entries()) {
        if (paidCreators.has(creatorId)) continue;

        const tier = (r as any).mapsToTier as any;
        const plan = await prisma.creatorMembershipPlan.findFirst({ where: { userId: creatorId, tier } });
        if (!plan) continue;

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.creatorMembership.upsert({
          where: { planId_userId: { planId: plan.id, userId } },
          update: { status: "ACTIVE", source: "NFT_GATE" as any, expiresAt, cancelAtPeriodEnd: false },
          create: { planId: plan.id, userId, status: "ACTIVE", source: "NFT_GATE" as any, expiresAt, cancelAtPeriodEnd: false },
        });
      }
    }
  }

  return { ok: true, processed: addresses.length };
}
