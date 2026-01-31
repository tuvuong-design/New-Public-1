import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getActiveMembershipTier } from "@/lib/membership";
import { getSensitiveModeForUser } from "@/lib/sensitive";
import VerifiedBadge from "@/components/badges/VerifiedBadge";
import SmartImage from "@/components/media/SmartImage";
import TipCreatorButton from "@/components/tips/TipCreatorButton";
import { getViewerFanClubTier } from "@/lib/creatorFanClub";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function avatarUrl(user: { image: string | null; avatarNftItem: { imageKey: string | null } | null }) {
  if (user.avatarNftItem?.imageKey) {
    return `${env.R2_PUBLIC_BASE_URL}/${user.avatarNftItem.imageKey}`;
  }
  return user.image;
}

export default async function UserLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const session = await auth();
  const viewerId = (session?.user as any)?.id as string | undefined;

  const channelUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      image: true,
      membershipTier: true,
      membershipExpiresAt: true,
      avatarNftItem: { select: { imageKey: true } },
    },
  });
  if (!channelUser) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card">Không tìm thấy user.</div>
      </div>
    );
  }

  const activeTier = getActiveMembershipTier(channelUser as any);
  const isSelf = viewerId === channelUser.id;
  const viewerFanClubTier = viewerId && !isSelf ? await getViewerFanClubTier(viewerId, channelUser.id) : null;
  const viewerFanClubLabel = viewerFanClubTier ? (viewerFanClubTier === "BRONZE" ? "Bronze" : viewerFanClubTier === "SILVER" ? "Silver" : "Gold") : null;
  const sensitiveMode = isSelf ? await getSensitiveModeForUser(viewerId ?? null) : null;
  const subCount = await prisma.subscription.count({ where: { channelUserId: channelUser.id } });
  const isSubscribed = viewerId
    ? Boolean(
        await prisma.subscription.findUnique({
          where: { subscriberId_channelUserId: { subscriberId: viewerId, channelUserId: channelUser.id } },
          select: { id: true },
        })
      )
    : false;

  const av = avatarUrl(channelUser);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="card flex items-center gap-3">
        <div className="relative h-12 w-12 overflow-hidden rounded-full bg-zinc-200">
          {av ? <SmartImage src={av} alt="avatar" fill className="object-cover" sizes="48px" /> : null}
          {channelUser.avatarNftItem?.imageKey ? (
            <span className="absolute bottom-0 right-0 rounded bg-black/70 px-1 py-0.5 text-[10px] font-semibold text-white">
              NFT
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-lg font-extrabold">{channelUser.name ?? "(no name)"}</div>
            <VerifiedBadge tier={activeTier as any} />
            {viewerFanClubLabel ? <Badge variant="secondary">⭐ {viewerFanClubLabel} Member</Badge> : null}
          </div>
          <div className="small muted">{subCount} subscribers</div>
        </div>
        <div className="flex items-center gap-2">
          {isSelf ? (
            <Link className="btn" href="/studio">
              Studio
            </Link>
          ) : viewerId ? (
            <div className="flex items-center gap-2">
              <TipCreatorButton toUserId={channelUser.id} label="Tip ⭐" />
            <form action="/api/subscriptions/toggle" method="post">
              <input type="hidden" name="channelUserId" value={channelUser.id} />
              <button className="btn" type="submit">
                {isSubscribed ? "Đang theo dõi" : "Theo dõi"}
              </button>
            </form>
            </div>
          ) : (
            <Link className="btn" href="/login">
              Đăng nhập để theo dõi
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className="btn" href={`/u/${channelUser.id}`}>
          Videos
        </Link>
        <Link className="btn" href={`/u/${channelUser.id}/community`}>
          Community
        </Link>
        <Link className="btn" href={`/u/${channelUser.id}/nfts`}>
          NFTs
        </Link>
      </div>

      {isSelf ? (
        <div id="sensitive" className="card">
          <div className="font-semibold">Cài đặt Sensitive Content</div>
          <div className="small muted mt-1">
            Chọn cách hiển thị video nhạy cảm: Hiển thị, Làm mờ (có thể bấm để xem), hoặc Ẩn (có thể bấm để xem).
          </div>
          <form action="/api/user/preferences/sensitive" method="post" className="mt-3 flex flex-wrap items-center gap-2">
            <select name="sensitiveMode" defaultValue={sensitiveMode ?? "BLUR"} className="rounded border px-2 py-1">
              <option value="SHOW">SHOW</option>
              <option value="BLUR">BLUR</option>
              <option value="HIDE">HIDE</option>
            </select>
            <button className="btn" type="submit">
              Lưu
            </button>
            <Link className="btn btn-muted" href="/me/settings">
              Link nhanh
            </Link>
          </form>
        </div>
      ) : null}

      {children}
    </div>
  );
}
