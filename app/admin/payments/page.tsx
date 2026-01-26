import PaymentsDashboardClient from "./ui/PaymentsDashboardClient";

export default function PaymentsPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; chain?: string; asset?: string };
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Payments dashboard</h2>
        <p className="text-sm text-muted-foreground">Fail-rate, volume, total deposits, provider accuracy, exports.</p>
      </div>
      <PaymentsDashboardClient initial={searchParams || {}} />
    </div>
  );
}
