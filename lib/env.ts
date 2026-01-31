import { z } from "zod";

/**
 * NOTE:
 * - File này **KHÔNG throw** khi thiếu env để hỗ trợ Install Wizard.
 * - Những chỗ cần env bắt buộc hãy dùng `requireEnv()`.
 */

const schema = z.object({
  SITE_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(10).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  REDIS_URL: z.string().min(1).optional(),

  // Similar videos cache (Redis)
  SIMILAR_CACHE_TTL_SECONDS: z.coerce.number().int().positive().optional().default(900),
  SIMILAR_CACHE_MAX_ITEMS: z.coerce.number().int().positive().optional().default(50),

  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().optional().default(2147483648),
  UPLOAD_PART_BYTES: z.coerce.number().int().positive().optional().default(209715200),

  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),

  // Player A/B origins (optional)
  R2_PUBLIC_BASE_URL_A: z.string().url().optional(),
  R2_PUBLIC_BASE_URL_B: z.string().url().optional(),
  // 0-100, percent traffic to A (rest to B). If unset, prefer A.
  R2_AB_SPLIT_PERCENT: z.coerce.number().int().min(0).max(100).optional().default(50),

  NEXT_PUBLIC_ENABLE_PWA: z.string().optional().default("true"),

  INDEXNOW_ENABLED: z.string().optional().default("false"),
  INDEXNOW_KEY: z.string().optional().default(""),
  INDEXNOW_KEY_LOCATION: z.string().optional().default(""),

  GA_ENABLED: z.string().optional().default("false"),
  GA_ID: z.string().optional().default(""),

  ONESIGNAL_ENABLED: z.string().optional().default("false"),
  ONESIGNAL_APP_ID: z.string().optional().default(""),
  ONESIGNAL_SAFARI_WEB_ID: z.string().optional().default(""),

  SUBTITLES_AUTO_ENABLED: z.string().optional().default("false"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_TRANSCRIBE_MODEL: z.string().optional().default("whisper-1"),

  CLAMAV_ENABLED: z.string().optional().default("false"),
  CLAMAV_HOST: z.string().optional().default("127.0.0.1"),
  CLAMAV_PORT: z.coerce.number().optional().default(3310),

  INSTALL_WIZARD_ENABLED: z.string().optional().default("false"),

  // Payments / Stars topup
  APP_ENV: z.enum(["dev", "prod"]).optional().default("dev"),
  PAYMENTS_RECONCILE_EVERY_MS: z.coerce.number().int().positive().optional().default(120000),
  // Nếu deposit ở trạng thái SUBMITTED quá X phút thì worker sẽ tự enqueue reconcile.
  PAYMENTS_SUBMITTED_STALE_MINUTES: z.coerce.number().int().positive().optional().default(10),
  // Sai số chấp nhận (basis points). 0.5% = 50 bps.
  PAYMENTS_TOLERANCE_BPS: z.coerce.number().int().min(0).optional().default(50),

  // RPC endpoints (khuyến nghị đặt riêng theo chain)
  SOLANA_RPC_URL: z.string().url().optional().default(""),
  EVM_RPC_URL_ETHEREUM: z.string().url().optional().default(""),
  EVM_RPC_URL_POLYGON: z.string().url().optional().default(""),
  EVM_RPC_URL_BSC: z.string().url().optional().default(""),
  EVM_RPC_URL_BASE: z.string().url().optional().default(""),

  // Webhook provider secrets (fallback nếu không dùng DB-config)
  ALCHEMY_WEBHOOK_SIGNING_KEY: z.string().optional().default(""),
  QUICKNODE_WEBHOOK_SECRET: z.string().optional().default(""),
  HELIUS_WEBHOOK_SECRET: z.string().optional().default(""),

  TRONGRID_API_URL: z.string().url().optional().default("https://api.trongrid.io"),
  TRONGRID_API_KEY: z.string().optional().default(""),

  DISCORD_ALERT_WEBHOOK_URL: z.string().url().optional().default(""),

  // Creator webhooks (Task 14): strict allowlist domains, CSV (e.g. "example.com,hooks.myapp.com")
  CREATOR_WEBHOOK_ALLOWLIST: z.string().optional().default(""),

  // Stars anti-fraud / risk rules (best-effort; enforced when REDIS_URL is configured)
  STARS_RISK_MAX_CREDIT_PER_USER_PER_DAY: z.string().optional().default("200000"),
  STARS_RISK_MAX_CREDITS_PER_USER_PER_HOUR: z.string().optional().default("8"),
  STARS_RISK_MIN_SECONDS_BETWEEN_CREDITS: z.string().optional().default("20"),

  // Cloudflare smart purge (optional)
  CLOUDFLARE_ZONE_ID: z.string().optional().default(""),
  CLOUDFLARE_API_TOKEN: z.string().optional().default(""),

  // Cloudflare CDN purge (optional)
  CLOUDFLARE_ZONE_ID: z.string().optional().default(""),
  CLOUDFLARE_API_TOKEN: z.string().optional().default(""),
  CDN_PURGE_ENABLED: z.string().optional().default("false"),

  // IPFS / NFT export
  NFT_STORAGE_PROVIDER: z.enum(["NFT_STORAGE", "LIGHTHOUSE"]).optional().default("NFT_STORAGE"),
  NFT_STORAGE_API_KEY: z.string().optional().default(""),
  LIGHTHOUSE_API_KEY: z.string().optional().default(""),
  IPFS_GATEWAY_BASE_URL: z.string().url().optional().default("https://ipfs.io/ipfs"),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);

export const flags = {
  pwa: env.NEXT_PUBLIC_ENABLE_PWA === "true",
  indexNow: env.INDEXNOW_ENABLED === "true",
  ga: env.GA_ENABLED === "true",
  oneSignal: env.ONESIGNAL_ENABLED === "true",
  subtitlesAuto: env.SUBTITLES_AUTO_ENABLED === "true",
  clamav: env.CLAMAV_ENABLED === "true",
  installWizard: env.INSTALL_WIZARD_ENABLED === "true",
};

export function creatorWebhookAllowlist() {
  const csv = String(env.CREATOR_WEBHOOK_ALLOWLIST || "").trim();
  return new Set(csv ? csv.split(",").map((s) => s.trim()).filter(Boolean) : []);
}

export function isConfiguredEnv() {
  const required = [
    env.SITE_URL,
    env.DATABASE_URL,
    env.AUTH_SECRET,
    env.NEXTAUTH_URL,
    env.REDIS_URL,
    env.R2_ACCOUNT_ID,
    env.R2_ACCESS_KEY_ID,
    env.R2_SECRET_ACCESS_KEY,
    env.R2_BUCKET,
    env.R2_PUBLIC_BASE_URL,
  ];
  return required.every((v) => typeof v === "string" && v.length > 0);
}

export function requireEnv() {
  const requiredSchema = schema.extend({
    SITE_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(10),
    NEXTAUTH_URL: z.string().url(),
    REDIS_URL: z.string().min(1),

    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    R2_PUBLIC_BASE_URL: z.string().url(),
  });

  return requiredSchema.parse(process.env);
}
