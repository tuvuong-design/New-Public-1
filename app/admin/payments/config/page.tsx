import { prisma } from "@/lib/prisma";
import { getOrInitPaymentConfig } from "@/lib/payments/config";
import PaymentsConfigClient from "./ui/PaymentsConfigClient";

export default async function PaymentsConfigPage() {
  const cfg = await getOrInitPaymentConfig();
  const secrets = await prisma.paymentProviderSecret.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Payments config</h2>
        <p className="text-sm text-muted-foreground">Strict per chain/provider, provider accuracy mode, tolerance, cron, and provider secrets by env.</p>
      </div>
      <PaymentsConfigClient initialConfig={cfg} initialSecrets={secrets} />
    </div>
  );
}
