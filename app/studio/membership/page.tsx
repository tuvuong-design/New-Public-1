import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MembershipPlansManager } from "@/components/studio/MembershipPlansManager";
import NftGateRulesManager from "@/components/studio/NftGateRulesManager";

export const dynamic = "force-dynamic";

export default async function StudioMembershipPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const plans = await prisma.creatorMembershipPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const nftGateRules = await prisma.nftGateRule.findMany({ where: { creatorId: userId }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Fan Club (Creator Membership)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Tạo gói membership để người xem join và ủng hộ bạn định kỳ bằng ⭐.
          </p>
          <MembershipPlansManager initialPlans={plans as any} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NFT Gate (Proof-of-Fandom)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Cho phép holder NFT auto unlock tier Silver/Gold. Cần bật flag trong Admin → Config → NFT Gated Features.
          </p>
          <NftGateRulesManager initialRules={nftGateRules as any} />
        </CardContent>
      </Card>
    </div>
  );
}
