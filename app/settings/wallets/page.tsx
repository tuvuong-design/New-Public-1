import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import WalletsManager from "@/components/settings/WalletsManager";

export const dynamic = "force-dynamic";

export default async function WalletSettingsPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const wallets = await prisma.userWallet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, chain: true, address: true, verifiedAt: true, createdAt: true, updatedAt: true },
  });

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Wallet linking</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Link wallet để dùng các tính năng NFT-gated (Proof-of-Fandom, Premium NFT unlock, Creator Pass, Badges).
            Hệ thống chỉ dùng snapshot holdings (worker sync), không query RPC trong web request.
          </p>
          <WalletsManager initialWallets={wallets as any} />
        </CardContent>
      </Card>
    </div>
  );
}
