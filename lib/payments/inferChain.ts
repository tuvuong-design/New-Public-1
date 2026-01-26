import type { Chain } from "@prisma/client";

export function inferChainFromAlchemy(payload: any): Chain | null {
  const net = payload?.event?.network || payload?.network || payload?.data?.network || payload?.webhook?.network;
  if (typeof net !== "string") return null;
  const n = net.toLowerCase();
  if (n.includes("eth")) return "ETHEREUM";
  if (n.includes("polygon") || n.includes("matic")) return "POLYGON";
  if (n.includes("bsc") || n.includes("binance")) return "BSC";
  if (n.includes("base")) return "BASE";
  return null;
}

export function inferChainFromQuicknode(payload: any): Chain | null {
  const net = payload?.network || payload?.data?.network || payload?.event?.network;
  if (typeof net !== "string") return null;
  const n = net.toLowerCase();
  if (n.includes("sol")) return "SOLANA";
  if (n.includes("eth")) return "ETHEREUM";
  if (n.includes("polygon") || n.includes("matic")) return "POLYGON";
  if (n.includes("bsc") || n.includes("binance")) return "BSC";
  if (n.includes("base")) return "BASE";
  if (n.includes("tron")) return "TRON";
  return null;
}
