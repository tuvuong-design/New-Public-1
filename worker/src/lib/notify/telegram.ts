import { env } from "../../env";

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

/**
 * Telegram notifier (best-effort) for worker.
 * Env:
 * - TELEGRAM_NOTIFY_ENABLED=true
 * - TELEGRAM_BOT_TOKEN=123456:ABC...
 * - TELEGRAM_CHAT_ID=-100xxxxxxxxxx
 */
export async function sendTelegramWorker(text: string) {
  const enabled = (env.TELEGRAM_NOTIFY_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) return { ok: false as const, skipped: true as const, reason: "disabled" };

  const token = env.TELEGRAM_BOT_TOKEN || "";
  const chatId = env.TELEGRAM_CHAT_ID || "";
  if (!token || !chatId) return { ok: false as const, skipped: true as const, reason: "missing_token_or_chat_id" };

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!res || !res.ok) {
    const txt = await res?.text().catch(() => "");
    return { ok: false as const, error: txt || "telegram_failed" };
  }
  return { ok: true as const };
}

export function fmtDepositAlertTitle(title: string) {
  return `<b>${esc(title)}</b>`;
}
