import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SITE_URL: z.string().url(),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url(),

  SUBTITLES_AUTO_ENABLED: z.string().optional().default("false"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_TRANSCRIBE_MODEL: z.string().optional().default("whisper-1"),

  CLAMAV_ENABLED: z.string().optional().default("false"),
  CLAMAV_HOST: z.string().optional().default("127.0.0.1"),
  CLAMAV_PORT: z.coerce.number().optional().default(3310),

  APP_ENV: z.enum(["dev", "prod"]).optional().default("dev"),

  FFMPEG_FONT_PATH: z.string().optional().default("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),

  PAYMENTS_RECONCILE_EVERY_MS: z.coerce.number().int().positive().optional().default(120000),
  PAYMENTS_SUBMITTED_STALE_MINUTES: z.coerce.number().int().positive().optional().default(10),
  PAYMENTS_TOLERANCE_BPS: z.coerce.number().int().min(0).optional().default(50),

  PAYMENTS_WATCH_BSC_EVERY_MS: z.coerce.number().int().positive().optional().default(60000),
  PAYMENTS_WATCH_TRON_EVERY_MS: z.coerce.number().int().positive().optional().default(60000),
  PAYMENTS_WATCH_SOLANA_EVERY_MS: z.coerce.number().int().positive().optional().default(60000),
  PAYMENTS_WATCH_EVM_EVERY_MS: z.coerce.number().int().positive().optional().default(60000),
  PAYMENTS_WATCHER_STALE_MINUTES: z.coerce.number().int().positive().optional().default(10),
  PAYMENTS_EVM_CONFIRMATIONS: z.coerce.number().int().min(0).optional().default(5),
  PAYMENTS_WATCH_BLOCK_WINDOW: z.coerce.number().int().positive().optional().default(2000),

  
  // Telegram notify (best-effort)
  TELEGRAM_NOTIFY_ENABLED: z.string().optional().default("false"),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_CHAT_ID: z.string().optional().default(""),

// Notifications
  NOTIFICATIONS_WEEKLY_DIGEST_EVERY_MS: z.coerce.number().int().positive().optional().default(24 * 60 * 60 * 1000),
  NOTIFICATIONS_CONTINUE_WATCHING_DIGEST_EVERY_MS: z.coerce.number().int().positive().optional().default(24 * 60 * 60 * 1000),
  NOTIFICATIONS_CONTINUE_WATCHING_LOOKBACK_DAYS: z.coerce.number().int().positive().optional().default(7),
  NOTIFICATIONS_CONTINUE_WATCHING_MAX_ITEMS: z.coerce.number().int().positive().optional().default(3),
  NOTIFICATIONS_CONTINUE_WATCHING_MAX_USERS_PER_RUN: z.coerce.number().int().positive().optional().default(200),

  NOTIFICATIONS_WEEKLY_DIGEST_EMAIL_ENABLED: z.string().optional().default("false"),
  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_FROM_EMAIL: z.string().optional().default(""),

  // Moderation escalation (optional)
  MODERATION_ESCALATION_ENABLED: z.string().optional().default("false"),
  MODERATION_AUTO_MUTE_STRIKES: z.coerce.number().int().min(0).optional().default(3),
  MODERATION_AUTO_BAN_STRIKES: z.coerce.number().int().min(0).optional().default(5),
  MODERATION_REPORT_VELOCITY_WINDOW_MIN: z.coerce.number().int().min(1).optional().default(30),
  MODERATION_REPORT_VELOCITY_THRESHOLD: z.coerce.number().int().min(1).optional().default(5),

  // Creator memberships
  MEMBERSHIP_BILLING_EVERY_MS: z.coerce.number().int().positive().optional().default(3600000),
  MEMBERSHIP_RENEW_AHEAD_HOURS: z.coerce.number().int().min(0).optional().default(24),

  SOLANA_RPC_URL: z.string().url().optional().default(""),
  SOLANA_NFT_MINT_ENABLED: z.string().optional().default("false"),
  SOLANA_MINT_AUTHORITY_SECRET_JSON: z.string().optional().default(""),
  EVM_RPC_URL_ETHEREUM: z.string().url().optional().default(""),
  EVM_RPC_URL_POLYGON: z.string().url().optional().default(""),
  EVM_RPC_URL_BSC: z.string().url().optional().default(""),
  EVM_RPC_URL_BASE: z.string().url().optional().default(""),

  ALCHEMY_WEBHOOK_SIGNING_KEY: z.string().optional().default(""),
  QUICKNODE_WEBHOOK_SECRET: z.string().optional().default(""),
  HELIUS_WEBHOOK_SECRET: z.string().optional().default(""),

  TRONGRID_API_URL: z.string().url().optional().default("https://api.trongrid.io"),
  TRONGRID_API_KEY: z.string().optional().default(""),

  DISCORD_ALERT_WEBHOOK_URL: z.string().url().optional().default(""),

  // Cloudflare smart purge (optional)
  CLOUDFLARE_ZONE_ID: z.string().optional().default(""),
  CLOUDFLARE_API_TOKEN: z.string().optional().default(""),

  // Creator webhooks: strict allowlist domains, CSV (optional)
  CREATOR_WEBHOOK_ALLOWLIST: z.string().optional().default(""),

  // IPFS / NFT export
  NFT_STORAGE_PROVIDER: z.enum(["NFT_STORAGE", "LIGHTHOUSE"]).optional().default("NFT_STORAGE"),
  NFT_STORAGE_API_KEY: z.string().optional().default(""),
  LIGHTHOUSE_API_KEY: z.string().optional().default(""),
  IPFS_GATEWAY_BASE_URL: z.string().url().optional().default("https://ipfs.io/ipfs"),
});

export const env = schema.parse(process.env);
export const flags = {
  subtitlesAuto: env.SUBTITLES_AUTO_ENABLED === "true",
  clamav: env.CLAMAV_ENABLED === "true",
};

export function creatorWebhookAllowlist() {
  const csv = String(env.CREATOR_WEBHOOK_ALLOWLIST || "").trim();
  return new Set(csv ? csv.split(",").map((s) => s.trim()).filter(Boolean) : []);
}
