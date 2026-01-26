import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { getSiteConfig } from "@/lib/siteConfig";

export const runtime = "nodejs";

function validateContractAddressByChain(chain: string, addressRaw: string) {
  const address = String(addressRaw || "").trim();
  if (!address) throw new Error("ADDRESS_REQUIRED");

  if (chain === "SOLANA") {
    // Base58 pubkey (no 0/O/I/l)
    const re = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!re.test(address)) throw new Error("SOLANA_ADDRESS_INVALID");
    return address;
  }

  if (chain === "TRON") {
    // Base58Check (T...) or hex41...
    const base58 = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
    const hex41 = /^41[a-fA-F0-9]{40}$/;
    if (!base58.test(address) && !hex41.test(address)) throw new Error("TRON_ADDRESS_INVALID");
    return address;
  }

  // EVM chains
  const evm = /^0x[a-fA-F0-9]{40}$/;
  if (!evm.test(address)) throw new Error("EVM_ADDRESS_INVALID");
  return address;
}

function clean(s: FormDataEntryValue | null) {
  return String(s || "").trim();
}

function addHours(d: Date, hours: number) {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

async function notifyAdmins(args: { title: string; body: string; dataJson?: any; url?: string }) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admins.length) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: "SYSTEM",
      title: args.title,
      body: args.body,
      url: args.url,
      dataJson: args.dataJson ? JSON.stringify(args.dataJson) : null,
    })),
    skipDuplicates: false,
  });
}

export async function GET() {
  const session = await auth();
  requireAdmin(session);

  const cfg = await getSiteConfig();
  const delayHours = Number((cfg as any).nftExportContractChangeDelayHours ?? 24);
  const rows = await prisma.nftChainContract.findMany({ orderBy: { chain: "asc" } });
  return Response.json({ delayHours, contracts: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  requireAdmin(session);

  if (!userId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const cfg = await getSiteConfig();
  const delayHours = Number((cfg as any).nftExportContractChangeDelayHours ?? 24);

  const form = await req.formData();
  const action = clean(form.get("action"));
  const chain = clean(form.get("chain"));

  const allowedChains = new Set(["SOLANA", "ETHEREUM", "POLYGON", "BSC", "BASE", "TRON"]);
  if (!allowedChains.has(chain)) return Response.json({ error: "CHAIN_NOT_ALLOWED" }, { status: 400 });

  if (!chain) return Response.json({ error: "CHAIN_REQUIRED" }, { status: 400 });

  if (action === "SET_PENDING") {
    let address = "";
    try {
      address = validateContractAddressByChain(chain, clean(form.get("address")));
    } catch (e: any) {
      const url = new URL("/admin/nft/contracts", req.url);
      url.searchParams.set("err", String(e?.message || e));
      url.searchParams.set("chain", chain);
      return Response.redirect(url);
    }

    const now = new Date();
    const pendingApplyAt = addHours(now, delayHours);

    const existing = await prisma.nftChainContract.findUnique({ where: { chain: chain as any } });

    await prisma.nftChainContract.upsert({
      where: { chain: chain as any },
      create: {
        chain: chain as any,
        address: address,
        isPrimary: existing?.isPrimary ?? false,
        pendingAddress: address,
        pendingApplyAt,
        pendingSetById: userId || null,
      },
      update: {
        pendingAddress: address,
        pendingApplyAt,
        pendingSetById: userId || null,
      },
    });

    await prisma.nftEventLog.create({
      data: {
        actorId: userId,
        action: "NFT_CONTRACT_PENDING_SET",
        dataJson: JSON.stringify({ chain, fromAddress: existing?.address || null, toAddress: address, pendingApplyAt: pendingApplyAt.toISOString() }),
      },
    });

    await notifyAdmins({
      title: `NFT contract change scheduled (${chain})`,
      body: `Pending contract set for ${chain}. It can be applied after ${pendingApplyAt.toLocaleString()}.`,
      url: "/admin/nft/contracts",
      dataJson: { chain, fromAddress: existing?.address || null, toAddress: address, pendingApplyAt: pendingApplyAt.toISOString() },
    });

    const url = new URL("/admin/nft/contracts", req.url);
    url.searchParams.set("ok", "PENDING_SET");
    url.searchParams.set("chain", chain);
    url.searchParams.set("applyAt", pendingApplyAt.toISOString());
    return Response.redirect(url);
  }

  if (action === "APPLY_PENDING") {
    const row = await prisma.nftChainContract.findUnique({ where: { chain: chain as any } });
    if (!row?.pendingAddress || !row.pendingApplyAt) {
      return Response.redirect(new URL("/admin/nft/contracts", req.url));
    }
    const now = new Date();
    if (row.pendingApplyAt > now) {
      const url = new URL("/admin/nft/contracts", req.url);
      url.searchParams.set("err", "NOT_DUE_YET");
      url.searchParams.set("chain", chain);
      url.searchParams.set("applyAt", row.pendingApplyAt.toISOString());
      return Response.redirect(url);
    }

    await prisma.nftChainContract.update({
      where: { chain: chain as any },
      data: { address: row.pendingAddress, pendingAddress: null, pendingApplyAt: null, pendingSetById: null },
    });

    await prisma.nftEventLog.create({
      data: {
        actorId: userId,
        action: "NFT_CONTRACT_APPLIED",
        dataJson: JSON.stringify({ chain, fromAddress: row.address, toAddress: row.pendingAddress }),
      },
    });

    await notifyAdmins({
      title: `NFT contract change applied (${chain})`,
      body: `Contract updated for ${chain}. Old: ${row.address} -> New: ${row.pendingAddress}.`,
      url: "/admin/nft/contracts",
      dataJson: { chain, fromAddress: row.address, toAddress: row.pendingAddress },
    });

    const url = new URL("/admin/nft/contracts", req.url);
    url.searchParams.set("ok", "APPLIED");
    url.searchParams.set("chain", chain);
    return Response.redirect(url);
  }

  return Response.json({ error: "ACTION_NOT_SUPPORTED" }, { status: 400 });
}
