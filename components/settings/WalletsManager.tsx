"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Wallet = {
  id: string;
  chain: string;
  address: string;
  verifiedAt: string | null;
  createdAt: string;
};

function hasPhantom() {
  return typeof window !== "undefined" && (window as any).solana?.isPhantom;
}
function hasEvm() {
  return typeof window !== "undefined" && (window as any).ethereum?.request;
}

export default function WalletsManager({ initialWallets }: { initialWallets: Wallet[] }) {
  const [wallets, setWallets] = useState<Wallet[]>(initialWallets || []);
  const [chain, setChain] = useState<string>("SOLANA");
  const [address, setAddress] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string>("");

  const sorted = useMemo(() => [...wallets].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [wallets]);

  async function refreshList() {
    const res = await fetch("/api/wallets/list");
    const data = await res.json().catch(() => ({}));
    if (data?.ok && Array.isArray(data.wallets)) setWallets(data.wallets);
  }

  async function unlink(id: string) {
    setMsg("");
    const res = await fetch("/api/wallets/unlink", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ walletId: id }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) { setMsg(String(data?.message ?? "UNLINK_FAILED")); return; }
    startTransition(() => refreshList());
  }

  async function syncAll() {
    setMsg("");
    const res = await fetch("/api/wallets/sync", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) { setMsg(String(data?.message ?? "SYNC_FAILED")); return; }
    setMsg("Đã enqueue sync ✅ (worker sẽ cập nhật holdings)");
  }

  async function connectSolana() {
    setMsg("");
    try {
      const solana = (window as any).solana;
      if (!solana?.connect || !solana?.signMessage) { setMsg("Phantom chưa sẵn sàng"); return; }
      const resp = await solana.connect();
      const addr = String(resp?.publicKey?.toString?.() ?? "");
      if (!addr) { setMsg("Không lấy được address"); return; }

      const ch = await fetch("/api/wallets/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chain: "SOLANA", address: addr }) });
      const chData = await ch.json().catch(() => ({}));
      if (!ch.ok || !chData?.ok) { setMsg(String(chData?.message ?? "CHALLENGE_FAILED")); return; }
      const message = String(chData.message || "");
      const encoded = new TextEncoder().encode(message);
      const sig = await solana.signMessage(encoded, "utf8");
      const sigBytes = sig?.signature as Uint8Array;
      const sigB64 = sigBytes ? btoa(String.fromCharCode(...Array.from(sigBytes))) : "";
      const link = await fetch("/api/wallets/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chain: "SOLANA", address: addr, message, signature: sigB64, signatureEncoding: "base64" }) });
      const linkData = await link.json().catch(() => ({}));
      if (!link.ok || !linkData?.ok) { setMsg(String(linkData?.message ?? "LINK_FAILED")); return; }
      setMsg("Đã link SOL wallet ✅");
      startTransition(() => refreshList());
    } catch (e: any) {
      setMsg(String(e?.message ?? "SOL_CONNECT_FAILED"));
    }
  }

  async function connectEvm() {
    setMsg("");
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum?.request) { setMsg("EVM wallet chưa sẵn sàng"); return; }
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const addr = String(accounts?.[0] ?? "");
      if (!addr) { setMsg("Không lấy được address"); return; }

      const ch = await fetch("/api/wallets/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chain: chain === "SOLANA" ? "ETHEREUM" : chain, address: addr }) });
      const chData = await ch.json().catch(() => ({}));
      if (!ch.ok || !chData?.ok) { setMsg(String(chData?.message ?? "CHALLENGE_FAILED")); return; }
      const message = String(chData.message || "");
      const sig = await ethereum.request({ method: "personal_sign", params: [message, addr] });
      const link = await fetch("/api/wallets/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chain: chain === "SOLANA" ? "ETHEREUM" : chain, address: addr, message, signature: sig, signatureEncoding: "hex" }) });
      const linkData = await link.json().catch(() => ({}));
      if (!link.ok || !linkData?.ok) { setMsg(String(linkData?.message ?? "LINK_FAILED")); return; }
      setMsg("Đã link EVM wallet ✅");
      startTransition(() => refreshList());
    } catch (e: any) {
      setMsg(String(e?.message ?? "EVM_CONNECT_FAILED"));
    }
  }

  async function manualLink() {
    setMsg("");
    const addr = address.trim();
    if (!addr) { setMsg("Nhập address"); return; }
    setMsg("Hãy dùng Connect để ký message (manual signature chưa hỗ trợ trong UI này).");
  }

  return (
    <div className="space-y-3">
      {msg ? <div className="text-sm">{msg}</div> : null}

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={syncAll} variant="secondary">Sync holdings</Button>
        {hasPhantom() ? <Button disabled={pending} onClick={connectSolana}>Connect Phantom (Solana)</Button> : <Button disabled variant="secondary">Phantom not found</Button>}
        {hasEvm() ? <Button disabled={pending} onClick={connectEvm} variant="secondary">Connect EVM (MetaMask)</Button> : <Button disabled variant="secondary">EVM wallet not found</Button>}
      </div>

      <Card className="p-3">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Chain</div>
            <Select value={chain} onChange={(e) => setChain(e.target.value)}>
              <option value="SOLANA">SOLANA</option>
              <option value="ETHEREUM">ETHEREUM</option>
              <option value="POLYGON">POLYGON</option>
              <option value="BSC">BSC</option>
              <option value="BASE">BASE</option>
            </Select>
          </div>
          <div className="grid gap-1 md:col-span-2">
            <div className="text-xs text-muted-foreground">Address (manual)</div>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x... or Solana address" />
          </div>
        </div>
        <div className="mt-2">
          <Button disabled={pending} onClick={manualLink} variant="ghost">Manual link (info)</Button>
        </div>
      </Card>

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground">Chưa link wallet nào.</div>
        ) : (
          sorted.map((w) => (
            <Card key={w.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{w.chain}: {w.address}</div>
                  <div className="text-xs text-muted-foreground">Verified: {w.verifiedAt ? new Date(w.verifiedAt).toLocaleString() : "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  {w.verifiedAt ? <Badge variant="secondary">VERIFIED</Badge> : <Badge variant="secondary">UNVERIFIED</Badge>}
                  <Button disabled={pending} onClick={() => unlink(w.id)} variant="destructive">Unlink</Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
