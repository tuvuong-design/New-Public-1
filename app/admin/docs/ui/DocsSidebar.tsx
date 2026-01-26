"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DocsNav } from "@/lib/docs/docs";

export default function DocsSidebar({ nav }: { nav: DocsNav }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return nav;
    return {
      sections: nav.sections
        .map((s) => ({
          ...s,
          items: s.items.filter((it) =>
            (it.title + " " + it.slug).toLowerCase().includes(query)
          ),
        }))
        .filter((s) => s.items.length > 0),
    };
  }, [nav, q]);

  return (
    <aside className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-4 space-y-2">
        <div className="text-sm font-semibold">Docs</div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search docs..."
        />
      </div>

      <nav className="space-y-4">
        {filtered.sections.map((sec) => (
          <div key={sec.title} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {sec.title}
            </div>
            <div className="grid gap-1">
              {sec.items.map((it) => {
                const href = `/admin/docs/${it.slug}`;
                const active = pathname === href || pathname === `${href}/`;
                return (
                  <a
                    key={it.slug}
                    href={href}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm hover:bg-zinc-50",
                      active && "bg-zinc-100 font-semibold"
                    )}
                  >
                    {it.title}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
