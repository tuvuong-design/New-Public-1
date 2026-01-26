import { env } from "../../env";
import { getWorkerRedis } from "../../redis";

function yyyymmdd(d = new Date()): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function yyyymmddhh(d = new Date()): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}`;
}

export type StarsRiskResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function evaluateStarsCreditRisk(params: { userId: string; stars: number }): Promise<StarsRiskResult> {
  const redis = getWorkerRedis();
  if (!redis) return { ok: true };

  const now = new Date();
  const day = yyyymmdd(now);
  const hour = yyyymmddhh(now);

  const maxPerDay = Number(process.env.STARS_RISK_MAX_CREDIT_PER_USER_PER_DAY || 200000);
  const maxPerHour = Number(process.env.STARS_RISK_MAX_CREDITS_PER_USER_PER_HOUR || 8);
  const minGapSec = Number(process.env.STARS_RISK_MIN_SECONDS_BETWEEN_CREDITS || 20);

  const sumKey = `videoshare:payments:risk:v1:credit_sum:${params.userId}:${day}`;
  const cntHourKey = `videoshare:payments:risk:v1:credit_cnt:${params.userId}:${hour}`;
  const lastKey = `videoshare:payments:risk:v1:last_credit_ts:${params.userId}`;

  const multi = redis.multi();
  multi.get(lastKey);
  multi.incrby(sumKey, Math.max(0, Math.floor(params.stars)));
  multi.expire(sumKey, 48 * 3600);
  multi.incr(cntHourKey);
  multi.expire(cntHourKey, 6 * 3600);
  multi.set(lastKey, String(Math.floor(Date.now() / 1000)), "EX", 24 * 3600);

  const res = await multi.exec().catch(() => null);
  if (!res) return { ok: true };

  const lastTs = Number(res[0]?.[1] || 0);
  const newSum = Number(res[1]?.[1] || 0);
  const newHourCnt = Number(res[3]?.[1] || 0);

  if (lastTs && Math.floor(Date.now() / 1000) - lastTs < minGapSec) {
    return { ok: false, reason: `velocity_min_gap_${minGapSec}s` };
  }
  if (Number.isFinite(maxPerDay) && newSum > maxPerDay) {
    return { ok: false, reason: `daily_cap_${maxPerDay}` };
  }
  if (Number.isFinite(maxPerHour) && newHourCnt > maxPerHour) {
    return { ok: false, reason: `hourly_credits_cap_${maxPerHour}` };
  }

  return { ok: true };
}
