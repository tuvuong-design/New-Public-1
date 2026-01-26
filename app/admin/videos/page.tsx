import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminVideos() {
  const list = await prisma.video.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      isSensitive: true,
      createdAt: true,
      viewCount: true,
      likeCount: true,
      commentCount: true,
      shareCount: true,
      starCount: true,
      giftCount: true,
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Videos</CardTitle>
              <CardDescription>100 video mới nhất (metrics snapshot).</CardDescription>
            </div>
            <Badge variant="secondary">/admin/videos</Badge>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Stars</TableHead>
                <TableHead className="text-right">Gifts</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="max-w-[420px]">
                    <a href={`/admin/videos/${v.id}`} className="font-semibold hover:underline line-clamp-2">
                      {v.title}
                    </a>
                    {Boolean((v as any).isSensitive) ? (
                      <div className="mt-1">
                        <Badge variant="destructive">Sensitive</Badge>
                      </div>
                    ) : null}
                    <div className="text-xs text-zinc-500">{v.id}</div>
                  </TableCell>
                  <TableCell className="font-medium">{v.status}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.viewCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.likeCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.commentCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.shareCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.starCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.giftCount}</TableCell>
                  <TableCell className="text-xs text-zinc-500">
                    {new Date(v.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
