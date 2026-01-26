import { getHlsConfig } from "@/lib/siteConfig";
import HlsConfigForm from "./HlsConfigForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminHls() {
  const cfg = await getHlsConfig();

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>HLS config</CardTitle>
          <CardDescription>
            Worker sẽ đọc config này khi encode HLS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HlsConfigForm cfg={cfg as any} />
        </CardContent>
      </Card>
    </div>
  );
}
