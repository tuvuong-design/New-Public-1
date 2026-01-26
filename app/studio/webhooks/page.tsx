import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WebhooksManager from "@/components/studio/WebhooksManager";

export const dynamic = "force-dynamic";

export default async function StudioWebhooksPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const endpoints = await prisma.creatorWebhookEndpoint.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, enabled: true, eventsCsv: true, createdAt: true, updatedAt: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-zinc-500">Studio / Webhooks</div>
        <h2 className="text-2xl font-extrabold">Creator Webhooks</h2>
        <div className="small muted mt-1">
          Gửi sự kiện (hiện tại: TIP_RECEIVED) đến endpoint của bạn. Bắt buộc HTTPS. Có thể bật allowlist bằng env.
        </div>
      </div>

      <WebhooksManager
        initial={endpoints.map((e) => ({
          id: e.id,
          url: e.url,
          enabled: e.enabled,
          events: (e.eventsCsv || "").split(",").map((x) => x.trim()).filter(Boolean),
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        }))}
      />

      <div className="card small">
        <div className="font-semibold">Headers</div>
        <div className="mt-2 grid gap-1 text-xs text-zinc-700">
          <div><span className="font-mono">x-videoshare-event</span>: event type</div>
          <div><span className="font-mono">x-videoshare-delivery</span>: delivery id</div>
          <div><span className="font-mono">x-videoshare-timestamp</span>: unix seconds</div>
          <div><span className="font-mono">x-videoshare-signature</span>: HMAC SHA256 hex of body with your secret</div>
        </div>
      </div>
    </div>
  );
}
