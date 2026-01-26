import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MyChannelTabs } from "@/components/mychannel/MyChannelTabs";

export const dynamic = "force-dynamic";

export default async function MyChannelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  // Simple tab detection from request path (App Router does not expose pathname in server component).
  // We rely on the known structure and render all tabs; the active styles are applied in child pages.
  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 md:px-6 py-4">
      <div className="flex items-center gap-2 text-2xl font-extrabold">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border bg-white">📺</span>
        <span>Kênh của tôi</span>
      </div>

      <MyChannelTabs />

      <div className="mt-4">{children}</div>
    </div>
  );
}
