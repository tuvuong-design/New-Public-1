import { getDocsNav } from "@/lib/docs/docs";
import DocsSidebar from "./ui/DocsSidebar";

export const dynamic = "force-dynamic";

export default async function AdminDocsLayout({ children }: { children: React.ReactNode }) {
  const nav = getDocsNav();

  return (
    <div className="grid gap-6 md:grid-cols-[260px,1fr]">
      <DocsSidebar nav={nav} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
