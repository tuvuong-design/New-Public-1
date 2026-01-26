"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Tab({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`px-2 py-1 -mb-[1px] border-b-2 ${active ? "border-orange-500 text-orange-700" : "border-transparent text-neutral-700 hover:text-neutral-900"}`}
    >
      {label}
    </Link>
  );
}

export function MyChannelTabs() {
  return (
    <div className="mt-4 border-b flex gap-4">
      <Tab href="/my-channel" label="Quản lý kênh" />
      <Tab href="/my-channel/followers" label="Người theo dõi" />
      <Tab href="/my-channel/sync" label="Đồng bộ hóa" />
    </div>
  );
}
