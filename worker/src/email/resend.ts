import { env } from "../env";

export async function sendResendEmail(opts: { to: string; subject: string; html: string; text?: string }) {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const from = String(env.RESEND_FROM_EMAIL || "").trim();
  if (!apiKey || !from) {
    return { skipped: true, reason: "missing_resend_env" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
    }),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e?.message ?? e) }) } as any));

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, error: body };
  }

  const body = await res.json().catch(() => ({}));
  return { ok: true, id: body?.id ?? null };
}
