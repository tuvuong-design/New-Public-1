import type { Chain } from "@prisma/client";

export function txExplorerUrl(chain: Chain, txHash: string) {
  const h = encodeURIComponent(txHash);
  switch (chain) {
    case "SOLANA":
      return `https://solscan.io/tx/${h}`;
    case "ETHEREUM":
      return `https://etherscan.io/tx/${h}`;
    case "POLYGON":
      return `https://polygonscan.com/tx/${h}`;
    case "BSC":
      return `https://bscscan.com/tx/${h}`;
    case "BASE":
      return `https://basescan.org/tx/${h}`;
    case "TRON":
      return `https://tronscan.org/#/transaction/${h}`;
    default:
      return "";
  }
}

export function addressExplorerUrl(chain: Chain, address: string) {
  const a = encodeURIComponent(address);
  switch (chain) {
    case "SOLANA":
      return `https://solscan.io/account/${a}`;
    case "ETHEREUM":
      return `https://etherscan.io/address/${a}`;
    case "POLYGON":
      return `https://polygonscan.com/address/${a}`;
    case "BSC":
      return `https://bscscan.com/address/${a}`;
    case "BASE":
      return `https://basescan.org/address/${a}`;
    case "TRON":
      return `https://tronscan.org/#/address/${a}`;
    default:
      return "";
  }
}
