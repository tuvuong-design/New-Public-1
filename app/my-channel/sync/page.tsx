import { prisma } from "@/lib/prisma";
import { ChannelSyncPage } from "@/components/sync/ChannelSyncPage";

export const dynamic = "force-dynamic";

export default async function MyChannelSyncPage() {
  const channels = await prisma.channel.findMany({
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, slug: true },
  });

  return <ChannelSyncPage channels={channels} />;
}
