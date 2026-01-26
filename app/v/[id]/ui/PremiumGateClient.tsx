"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";

type Plan = {
  id: string;
  title: string;
  starsPrice: number;
  durationDays: number;
  benefits: string | null;
  tier: "BRONZE" | "SILVER" | "GOLD";
};

function tierLabel(tier: Plan["tier"]) {
  switch (tier) {
    case "GOLD":
      return "Gold";
    case "SILVER":
      return "Silver";
    case "BRONZE":
    default:
      return "Bronze";
  }
}

export default function PremiumGateClient({
  videoId,
  creatorId,
  creatorName,
  premiumUnlockStars,
  plans,
  nftUnlockAvailable,
  hasLinkedWallet,
  nftGateChains,
}: {
  videoId: string;
  creatorId: string;
  creatorName: string;
  premiumUnlockStars: number;
  plans: Plan[];
  nftUnlockAvailable: boolean;
  hasLinkedWallet: boolean;
  nftGateChains: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");
  const [walletMessage, setWalletMessage] = useState<string>("");
  const [wallets, setWallets] = useState<Array<{ id: string; chain: string; address: string }>>([]);
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [evmChain, setEvmChain] = useState<string>("ETHEREUM");
  const isMounted = useRef(false);

  const hasPlans = plans && plans.length > 0;
  const canUnlock = Number.isFinite(premiumUnlockStars) && premiumUnlockStars > 0;

  const sortedPlans = useMemo(() => {
    return [...(plans || [])].sort((a, b) => (a.starsPrice - b.starsPrice) || a.tier.localeCompare(b.tier));
  }, [plans]);

  const requiredChains = useMemo(() => {
    const list = Array.isArray(nftGateChains) ? nftGateChains.map((c) => String(c).toUpperCase()) : [];
    return Array.from(new Set(list));
  }, [nftGateChains]);

  const requiredEvmChains = useMemo(() => {
    const evm = ["ETHEREUM", "POLYGON", "BSC", "BASE"];
    return requiredChains.filter((c) => evm.includes(c));
  }, [requiredChains]);

  const requiresSolana = requiredChains.includes("SOLANA");

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      if (requiredEvmChains.length > 0) setEvmChain(requiredEvmChains[0]);
    }
  }, [requiredEvmChains]);

  async function refreshWalletList() {
    try {
      const res = await fetch("/api/wallets/list");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && Array.isArray(data.wallets)) {
        setWallets(data.wallets.map((w: any) => ({ id: String(w.id), chain: String(w.chain), address: String(w.address) })));
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (hasLinkedWallet) refreshWalletList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLinkedWallet]);

  async function joinPlan(planId: string) {
    setMessage("");
    const idem = `join:${planId}:${crypto.randomUUID()}`;
    const res = await fetch(`/api/creators/${creatorId}/membership/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId, idempotencyKey: idem }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setMessage(String(data?.message ?? "JOIN_FAILED"));
      return;
    }
    setMessage("Đã tham gia Fan Club ✅");
    startTransition(() => router.refresh());
  }


  async function unlockWithNft() {
    setMessage("");
    const res = await fetch(`/api/videos/${videoId}/nft-unlock/check`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setMessage(String(data?.message ?? "NFT_UNLOCK_FAILED"));
      return;
    }
    if (data?.allowed) {
      setMessage("Đã xác nhận NFT key ✅");
      startTransition(() => router.refresh());
      return;
    }
    setMessage(String(data?.message ?? "NFT_NOT_OWNED"));
  }

  async function pollNftCheck(maxTries = 4, delayMs = 1500) {
    for (let i = 0; i < maxTries; i++) {
      const res = await fetch(`/api/videos/${videoId}/nft-unlock/check`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && data?.allowed) return { ok: true, allowed: true };
      if (i < maxTries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
    return { ok: true, allowed: false };
  }

  async function syncWalletsAndCheck() {
    setWalletMessage("");
    setSyncing(true);
    try {
      const res = await fetch("/api/wallets/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setWalletMessage(String(data?.message ?? "SYNC_FAILED"));
        return;
      }
      setWalletMessage("Đang đồng bộ ownership…");
      const chk = await pollNftCheck();
      if (chk.allowed) {
        setWalletMessage("Đã xác nhận NFT key ✅");
        startTransition(() => router.refresh());
      } else {
        setWalletMessage("Chưa thấy NFT key (có thể cần chờ worker sync hoàn tất). Thử bấm Check NFT lại sau.");
      }
    } finally {
      setSyncing(false);
      refreshWalletList();
    }
  }

  async function unlinkWallet(walletId: string) {
    setWalletMessage("");
    try {
      const res = await fetch("/api/wallets/unlink", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setWalletMessage(String(data?.message ?? "UNLINK_FAILED"));
        return;
      }
      setWalletMessage("Đã unlink wallet ✅");
      await refreshWalletList();
      startTransition(() => router.refresh());
    } catch {
      setWalletMessage("UNLINK_ERROR");
    }
  }

  function shortAddr(a: string) {
    const s = String(a || "");
    if (s.length <= 12) return s;
    return `${s.slice(0, 6)}…${s.slice(-4)}`;
  }

  async function linkWallet(chain: string, address: string, sign: (message: string) => Promise<{ signature: string; encoding?: "base64" | "base58" | "hex" }>) {
    setWalletMessage("");
    setLinking(true);
    try {
      const c = String(chain).toUpperCase();
      const challengeRes = await fetch("/api/wallets/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chain: c, address }),
      });
      const challenge = await challengeRes.json().catch(() => ({}));
      if (!challengeRes.ok || !challenge?.ok) {
        setWalletMessage(String(challenge?.message ?? "CHALLENGE_FAILED"));
        return;
      }

      const msg = String(challenge.message || "");
      const sig = await sign(msg);

      const linkRes = await fetch("/api/wallets/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chain: c, address, message: msg, signature: sig.signature, signatureEncoding: sig.encoding }),
      });
      const linked = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok || !linked?.ok) {
        setWalletMessage(String(linked?.message ?? "LINK_FAILED"));
        return;
      }

      setWalletMessage("Đã link wallet ✅");
      await refreshWalletList();

      if (nftUnlockAvailable) {
        const chk = await pollNftCheck();
        if (chk.allowed) {
          setWalletMessage("Đã xác nhận NFT key ✅");
          startTransition(() => router.refresh());
          return;
        }
      }

      startTransition(() => router.refresh());
    } catch (e: any) {
      setWalletMessage(String(e?.message ?? "LINK_ERROR"));
    } finally {
      setLinking(false);
    }
  }

  async function connectPhantom() {
    const anyWin = window as any;
    const sol = anyWin?.solana;
    if (!sol || !sol.isPhantom) {
      setWalletMessage("Chưa thấy Phantom wallet. Hãy cài Phantom rồi thử lại.");
      return;
    }
    await sol.connect();
    const address = String(sol.publicKey?.toBase58?.() ?? sol.publicKey?.toString?.() ?? "");
    if (!address) {
      setWalletMessage("Không lấy được địa chỉ SOLANA.");
      return;
    }
    await linkWallet("SOLANA", address, async (msg) => {
      const enc = new TextEncoder();
      const signed = await sol.signMessage(enc.encode(msg), "utf8");
      const sigBytes = signed?.signature ? Uint8Array.from(signed.signature) : null;
      if (!sigBytes) throw new Error("SIGN_MESSAGE_FAILED");
      const b64 = btoa(String.fromCharCode(...Array.from(sigBytes)));
      return { signature: b64, encoding: "base64" };
    });
  }

  async function connectEvm() {
    const anyWin = window as any;
    const eth = anyWin?.ethereum;
    if (!eth) {
      setWalletMessage("Chưa thấy EVM wallet (MetaMask). Hãy cài MetaMask rồi thử lại.");
      return;
    }
    const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
    const address = String(accounts?.[0] ?? "").toLowerCase();
    if (!address) {
      setWalletMessage("Không lấy được địa chỉ EVM.");
      return;
    }
    const chain = (requiredEvmChains.includes(evmChain) ? evmChain : "ETHEREUM");
    await linkWallet(chain, address, async (msg) => {
      const sig = await eth.request({ method: "personal_sign", params: [msg, address] });
      return { signature: String(sig), encoding: "hex" };
    });
  }

  async function unlock() {
    setMessage("");
    const idem = `unlock:${videoId}:${crypto.randomUUID()}`;
    const res = await fetch(`/api/videos/${videoId}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: idem }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setMessage(String(data?.message ?? "UNLOCK_FAILED"));
      return;
    }
    setMessage("Đã mở khoá video ✅");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="text-lg font-extrabold">Nội dung Premium</div>
        <div className="mt-1 text-sm text-neutral-600">
          Video này chỉ dành cho hội viên Fan Club của <b>{creatorName}</b> hoặc người đã mở khoá bằng Stars.
        </div>

        {message ? <div className="mt-2 text-sm">{message}</div> : null}

        <div className="mt-4 grid gap-3">
          {hasPlans ? (
            <div>
              <div className="text-sm font-semibold">Tham gia Fan Club</div>
              <div className="mt-2 grid gap-2">
                {sortedPlans.map((p) => (
                  <Card key={p.id} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{p.title}</div>
                          <Badge variant="secondary">{tierLabel(p.tier)}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          {p.starsPrice} ⭐ / {p.durationDays} ngày
                        </div>
                        {p.benefits ? <div className="mt-2 text-xs whitespace-pre-wrap">{p.benefits}</div> : null}
                      </div>
                      <Button disabled={pending} onClick={() => joinPlan(p.id)}>
                        Join
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-neutral-600">Creator chưa bật gói Fan Club.</div>
          )}

          
          {nftUnlockAvailable ? (
            <Card className="p-3">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-sm font-semibold">Unlock with NFT</div>
                  <div className="mt-1 text-xs text-neutral-600">
                    {hasLinkedWallet
                      ? "Nếu bạn đang sở hữu NFT key, hệ thống sẽ cho phép xem ngay. Bạn có thể đồng bộ ownership nếu vừa mua/chuyển NFT."
                      : "Link wallet & ký message ngay tại đây để xác minh ownership (không cần rời trang)."}
                  </div>
                </div>

                {walletMessage ? <div className="text-xs text-neutral-700">{walletMessage}</div> : null}

                {hasLinkedWallet ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button disabled={pending || syncing || linking} variant="secondary" onClick={unlockWithNft}>
                      Check NFT
                    </Button>
                    <Button disabled={pending || syncing || linking} variant="outline" onClick={syncWalletsAndCheck}>
                      Sync & Check
                    </Button>
                    <Button disabled={pending || syncing || linking} variant="ghost" onClick={refreshWalletList}>
                      Refresh wallets
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {requiresSolana ? (
                        <Button disabled={pending || linking || syncing} variant="secondary" onClick={connectPhantom}>
                          Connect Phantom (SOL)
                        </Button>
                      ) : null}
                      {requiredEvmChains.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-40">
                            <Select value={evmChain} onChange={(e) => setEvmChain(e.target.value)}>
                              {requiredEvmChains.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <Button disabled={pending || linking || syncing} variant="secondary" onClick={connectEvm}>
                            Connect EVM
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Tip: Bạn vẫn có thể quản lý nhiều ví tại <a className="underline" href="/settings/wallets">/settings/wallets</a>.
                    </div>
                  </div>
                )}

                {hasLinkedWallet && wallets.length > 0 ? (
                  <div className="mt-2 space-y-1 text-[11px] text-neutral-500">
                    <div className="font-medium text-neutral-600">Linked wallets</div>
                    <div className="flex flex-col gap-1">
                      {wallets.slice(0, 3).map((w) => (
                        <div key={w.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                          <div className="truncate">{w.chain}:{shortAddr(w.address)}</div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending || syncing || linking}
                            onClick={() => unlinkWallet(w.id)}
                          >
                            Unlink
                          </Button>
                        </div>
                      ))}
                      {wallets.length > 3 ? <div>(+{wallets.length - 3} ví khác… quản lý tại /settings/wallets)</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          {canUnlock ? (
            <Card className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Mở khoá 1 lần</div>
                  <div className="mt-1 text-xs text-neutral-600">Trả {premiumUnlockStars} ⭐ để xem video này vĩnh viễn.</div>
                </div>
                <Button disabled={pending} onClick={unlock}>
                  Unlock
                </Button>
              </div>
            </Card>
          ) : (
            <div className="text-xs text-neutral-600">Video này chỉ dành cho hội viên (không hỗ trợ mở khoá bằng Stars).</div>
          )}
        </div>
      </Card>
    </div>
  );
}
