import { canAccessInstallWizard } from "@/lib/install/guard";
import { isConfiguredEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  if (!canAccessInstallWizard()) return new Response("Not found", { status: 404 });
  return Response.json({ ok: true, configured: isConfiguredEnv() });
}
