import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/videos", label: "Videos" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/nft/contracts", label: "NFT contracts" },
  { href: "/admin/nft/events", label: "NFT events" },
  { href: "/admin/config", label: "Config" },
  { href: "/admin/ads", label: "Ads" },
  { href: "/admin/hls", label: "HLS" },
  { href: "/admin/storage", label: "Storage" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/boost/plans", label: "Boost plans" },
  { href: "/admin/boost/orders", label: "Boost orders" },
  { href: "/admin/docs", label: "Docs" },
];

export default function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-2">
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-9")}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
