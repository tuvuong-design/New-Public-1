import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationSettingsForm } from "@/components/settings/NotificationSettingsForm";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const row = await prisma.notificationSetting.findUnique({
    where: { userId },
    select: { disabledTypesCsv: true },
  });

  const disabled = (row?.disabledTypesCsv || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cài đặt thông báo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Bỏ chọn để tắt nhận từng loại thông báo. (Mặc định: bật hết)
          </p>
          <NotificationSettingsForm initialDisabled={disabled} />
        </CardContent>
      </Card>
    </div>
  );
}
