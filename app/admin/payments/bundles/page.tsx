import { prisma } from "@/lib/prisma";
import BundlesClient from "./ui/BundlesClient";

export const dynamic = "force-dynamic";

export default async function BundlesAdminPage() {
  const packages = await prisma.starTopupPackage.findMany({
    orderBy: [{ chain: "asc" }, { sort: "asc" }, { stars: "asc" }],
    include: { token: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Bundles (Topup bonus)</h2>
        <p className="text-sm text-muted-foreground">Configure bonus stars / labels per topup package for ARPU boosting.</p>
      </div>
      <BundlesClient initialPackages={packages as any} />
    </div>
  );
}
