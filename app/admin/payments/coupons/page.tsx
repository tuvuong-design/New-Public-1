import { prisma } from "@/lib/prisma";
import CouponsClient from "./ui/CouponsClient";

export const dynamic = "force-dynamic";

export default async function CouponsAdminPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Coupons</h2>
        <p className="text-sm text-muted-foreground">Create and manage coupon codes for Stars Topup (bonus stars) and Season Pass (discount).</p>
      </div>
      <CouponsClient initialCoupons={coupons} />
    </div>
  );
}
