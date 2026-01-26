import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getStorageEndpointConfig } from "@/lib/storage/config";
import StorageConfigForm from "./storageConfigForm";

export const dynamic = "force-dynamic";

export default async function AdminStoragePage() {
  const row = await getStorageEndpointConfig();

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Storage redundancy</CardTitle>
              <CardDescription>
                R2 là primary. FTP/Google Drive là backup. Cấu hình thay đổi sẽ được áp dụng sau 24h và log/audit đầy đủ.
              </CardDescription>
            </div>
            <Badge variant="secondary">/admin/storage</Badge>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Config</CardTitle>
          <CardDescription>
            2 FTP tách riêng: FTP Origin (MP4 gốc) + FTP HLS (playlist/segments). Drive lưu origin để rebuild.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StorageConfigForm row={row as any} />
        </CardContent>
      </Card>
    </div>
  );
}
