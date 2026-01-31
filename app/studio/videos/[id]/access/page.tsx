import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/siteConfig";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VideoAccessManager from "@/components/studio/VideoAccessManager";

export const dynamic = "force-dynamic";

export default async function StudioVideoAccessPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const video = await prisma.video.findUnique({
    where: { id: params.id },
    select: { id: true, authorId: true, title: true, access: true, premiumUnlockStars: true, earlyAccessTier: true, earlyAccessUntil: true },
  });
  if (!video) redirect("/studio/videos");
  if (video.authorId !== userId && session?.user?.role !== "ADMIN") redirect("/studio/videos");

  const gates = await prisma.videoNftGate.findMany({ where: { videoId: video.id }, orderBy: { createdAt: "desc" } });
  const cfg = await getSiteConfig();

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Video Access: {video.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <VideoAccessManager
            videoId={video.id}
            initialAccess={(video.access as any) ?? "PUBLIC"}
            initialPremiumUnlockStars={Number(video.premiumUnlockStars ?? 0)}
            initialEarlyAccessTier={(video.earlyAccessTier as any) ?? null}
            initialEarlyAccessUntil={video.earlyAccessUntil ? new Date(video.earlyAccessUntil as any).toISOString() : null}
            initialGates={gates as any}
            nftPremiumUnlockEnabled={Boolean((cfg as any).nftPremiumUnlockEnabled)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
