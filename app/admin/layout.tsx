import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/authz";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        </div>
        <AdminNav />
      </div>
      {children}
    </main>
  );
}
