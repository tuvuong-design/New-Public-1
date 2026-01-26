import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import StudioNav from "@/components/studio/StudioNav";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Studio</h1>
        </div>
        <StudioNav />
      </div>
      {children}
    </main>
  );
}
