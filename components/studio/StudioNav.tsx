"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/studio/analytics", label: "Analytics" },
  { href: "/studio/revenue", label: "Revenue" },
  { href: "/studio/editor", label: "Editor" },
  { href: "/studio/record", label: "Record" },
  { href: "/studio/webhooks", label: "Webhooks" },
  { href: "/studio/membership", label: "Membership" },
  { href: "/studio/clips", label: "Clips" },
];

export default function StudioNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              active ? "bg-zinc-900 text-white" : "bg-white hover:bg-zinc-50",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
