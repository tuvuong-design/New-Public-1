import { safeJson } from "@/lib/api/safeJson";

/**
 * Telegram notifier (best-effort)
 *
 * ENV:
 * - TELEGRAM_NOTIFY_ENABLED=true|false
 * - TELEGRAM_BOT_TOKEN=123456:ABC...
 * - TELEGRAM_CHAT_ID=123456789 (user) hoặc -100xxxxxxxxxx (group/channel)
 */
export async function sendTelegram(text: string) {
  const enabled = (process.env.TELEGRAM_NOTIFY_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) return { ok: false as const, skipped: true as const, reason: "disabled" };

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (!token || !chatId) return { ok: false as const, skipped: true as const, reason: "missing_env" };

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false as const, skipped: false as const, reason: "http_error", detail: t.slice(0, 500) };
    }
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, skipped: false as const, reason: "exception", detail: safeJson(e).slice(0, 500) };
  }
}
