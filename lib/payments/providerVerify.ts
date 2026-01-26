import crypto from "crypto";
import type { PaymentProvider } from "@prisma/client";
import { getProviderSecret } from "@/lib/payments/config";

export async function verifyWebhookSignature(opts: {
  provider: PaymentProvider;
  rawBody: string;
  headers: Headers;
}): Promise<{ ok: boolean; reason?: string }> {
  const { provider, rawBody, headers } = opts;

  // NOTE: Mỗi provider có chuẩn signature khác nhau; chúng ta implement theo mẫu phổ biến.
  // Nếu user dùng proxy/transform, hãy tắt providerAccuracyMode hoặc cập nhật logic.

  if (provider === "ALCHEMY") {
    const sig = headers.get("x-alchemy-signature") || "";
    const key = await getProviderSecret("ALCHEMY", "webhookSigningKey");
    if (!key) return { ok: true, reason: "missing-secret" }; // fail-open if not configured
    const digest = crypto.createHmac("sha256", key).update(rawBody).digest("hex");
    return { ok: timingSafeEqualHex(sig, digest), reason: "alchemy" };
  }

  if (provider === "QUICKNODE") {
    const sig = headers.get("x-quicknode-signature") || headers.get("x-qn-signature") || "";
    const secret = await getProviderSecret("QUICKNODE", "webhookSecret");
    if (!secret) return { ok: true, reason: "missing-secret" };
    const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return { ok: timingSafeEqualHex(sig, digest), reason: "quicknode" };
  }

  if (provider === "HELIUS") {
    // Helius: thường dùng `authorization: Bearer <secret>` hoặc custom header.
    const bearer = headers.get("authorization") || "";
    const secret = await getProviderSecret("HELIUS", "webhookSecret");
    if (!secret) return { ok: true, reason: "missing-secret" };
    const ok = bearer === `Bearer ${secret}` || headers.get("x-helius-secret") === secret;
    return { ok, reason: "helius" };
  }

  // TRONGRID: không có standard signature bắt buộc. Có thể dùng IP allowlist...
  return { ok: true };
}

function timingSafeEqualHex(a: string, b: string) {
  try {
    const aa = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}
