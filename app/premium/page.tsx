import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";
import { getActiveMembershipTier, isPremium, isPremiumPlus } from "@/lib/membership";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return d.toLocaleString();
}

export default async function PremiumPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;

  const cfg = await getSiteConfig();
  const premiumPriceStars = Number((cfg as any).premiumPriceStars ?? 499);
  const premiumDays = Number((cfg as any).premiumDays ?? 30);
  const premiumPlusPriceStars = Number((cfg as any).premiumPlusPriceStars ?? 999);
  const premiumPlusDays = Number((cfg as any).premiumPlusDays ?? 30);

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          starBalance: true,
          membershipTier: true,
          membershipExpiresAt: true,
          premiumPlusHideBoostAds: true,
        },
      })
    : null;

  const activeTier = user ? getActiveMembershipTier(user as any) : "NONE";
  const exp = user?.membershipExpiresAt ? new Date(user.membershipExpiresAt) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card">
        <div className="text-xl font-extrabold">Premium</div>
        <div className="small muted mt-1">
          Premium giúp giảm quảng cáo (HTML ads) và mở khóa một số tính năng nâng cao. (Boost ads là một phần của hệ thống
          “Boost video”.)
        </div>
      </div>

      <div className="card">
        <div className="font-bold">Tình trạng</div>
        {!user ? (
          <div className="small muted mt-2">Bạn cần đăng nhập để mua Premium.</div>
        ) : (
          <div className="mt-2 grid gap-1">
            <div>
              Tier: <b>{activeTier}</b>
            </div>
            <div>
              Expires: <b>{exp ? fmtDate(exp) : "—"}</b>
            </div>
            <div>
              Stars balance: <b>⭐ {user.starBalance}</b>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <div className="card">
          <div className="text-lg font-extrabold">Premium</div>
          <ul className="mt-2 list-disc pl-6 text-sm">
            <li>Ẩn HTML quảng cáo (ads placements) trên web.</li>
            <li>Vẫn có thể thấy video được “Boost” (Sponsored) trong feed.</li>
            <li>Dấu tích xác nhận (verified badge) ở profile và comments.</li>
          </ul>

          <form action="/api/membership/purchase" method="post" className="mt-3">
            <input type="hidden" name="tier" value="PREMIUM" />
            <button className="btn" disabled={!user || isPremium({ membershipTier: activeTier, membershipExpiresAt: exp })}>
              Mua Premium • ⭐ {premiumPriceStars} / {premiumDays} ngày
            </button>
          </form>
        </div>

        <div className="card">
          <div className="text-lg font-extrabold">Premium+</div>
          <ul className="mt-2 list-disc pl-6 text-sm">
            <li>Tất cả quyền của Premium.</li>
            <li>Có thể xem video “Premium+ only”.</li>
            <li>Tuỳ chọn ẩn Boost ads trong feed.</li>
            <li>Highlight comment (badge) và có quota boost miễn phí mỗi tháng.</li>
          </ul>

          <form action="/api/membership/purchase" method="post" className="mt-3">
            <input type="hidden" name="tier" value="PREMIUM_PLUS" />
            <button
              className="btn"
              disabled={!user || isPremiumPlus({ membershipTier: activeTier, membershipExpiresAt: exp })}
            >
              Mua Premium+ • ⭐ {premiumPlusPriceStars} / {premiumPlusDays} ngày
            </button>
          </form>

          {user ? (
            <form action="/api/membership/settings" method="post" className="mt-3 grid gap-2">
              <input type="hidden" name="intent" value="toggleBoostAds" />
              <label className="row gap-2 text-sm">
                <input
                  type="checkbox"
                  name="premiumPlusHideBoostAds"
                  defaultChecked={Boolean(user.premiumPlusHideBoostAds)}
                  disabled={!isPremiumPlus({ membershipTier: activeTier, membershipExpiresAt: exp })}
                />
                Ẩn Boost ads trong feed (chỉ Premium+)
              </label>
              <button className="btn" disabled={!isPremiumPlus({ membershipTier: activeTier, membershipExpiresAt: exp })}>
                Lưu
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="small muted">
        Lưu ý: Premium không hoàn tiền. Nếu bạn không đủ Stars, hãy topup trong <a className="underline" href="/stars/topup">/stars/topup</a>.
      </div>
    </div>
  );
}
