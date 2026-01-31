import FraudAlertsClient from "./ui/FraudAlertsClient";

export default function FraudPage({
  searchParams,
}: {
  searchParams?: { status?: string; kind?: string; severity?: string; q?: string; page?: string };
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Fraud radar</h2>
        <p className="text-sm text-muted-foreground">Signals & alerts for Stars topups / deposits. Acknowledge, resolve, and drill into deposits.</p>
      </div>
      <FraudAlertsClient initial={searchParams || {}} />
    </div>
  );
}
