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

  // Notifications
  NOTIFICATIONS_WEEKLY_DIGEST_EVERY_MS: z.coerce.number().int().positive().optional().default(24 * 60 * 60 * 1000),

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
