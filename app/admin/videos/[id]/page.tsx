import { prisma } from "@/lib/prisma";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import SmartImage from "@/components/media/SmartImage";

export const dynamic = "force-dynamic";

export default async function AdminVideoDetail({ params }: { params: { id: string } }) {
  const [v, categories] = await Promise.all([
    prisma.video.findUnique({
      where: { id: params.id },
      include: {
        author: true,
        category: true,
        channel: true,
        subtitles: true,
        tags: { include: { tag: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!v) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not found</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const src = resolveMediaUrl(v.sourceKey) ?? "";
  const hls = resolveMediaUrl(v.masterM3u8Key) ?? "";
  const thumb = resolveMediaUrl(v.thumbKey) ?? "";
  const tagsStr = v.tags
    .map((t) => t.tag.slug || t.tag.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{v.title}</CardTitle>
              <CardDescription>
                ID: <span className="font-mono text-xs">{v.id}</span> • Status:{" "}
                <span className="font-semibold">{v.status}</span>
              </CardDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">Views {v.viewCount}</Badge>
                <Badge variant="secondary">Likes {v.likeCount}</Badge>
                <Badge variant="secondary">Stars {v.starCount}</Badge>
                <Badge variant="secondary">Gifts {v.giftCount}</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href={`/v/${v.id}`}>
                <Button variant="outline">Open public page</Button>
              </a>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <div className="text-xs text-zinc-500">Author</div>
            <div className="text-sm">{v.author?.email ?? "-"}</div>
          </div>

          <Separator />

          <div className="grid gap-3">
            <div>
              <div className="text-xs text-zinc-500">Source object</div>
              <a href={src} className="text-sm hover:underline break-all">
                {src}
              </a>
            </div>

            <div>
              <div className="text-xs text-zinc-500">HLS master</div>
              {hls ? (
                <a href={hls} className="text-sm hover:underline break-all">
                  {hls}
                </a>
              ) : (
                <div className="text-sm text-zinc-500">Chưa có</div>
              )}
            </div>

            <div>
              <div className="text-xs text-zinc-500">Thumbnail</div>
              {thumb ? (
                <div className="mt-2 w-[320px]">
                  <SmartImage
                    src={thumb}
                    alt="thumb"
                    width={320}
                    height={180}
                    className="w-[320px] rounded-2xl border object-cover"
                    sizes="320px"
                  />
                </div>
              ) : (
                <div className="text-sm text-zinc-500">Chưa có</div>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <form action="/api/admin/videos/requeue" method="post">
              <input type="hidden" name="videoId" value={v.id} />
              <Button type="submit" variant="secondary">Re-queue process</Button>
            </form>

            <form action="/api/admin/videos/publish" method="post">
              <input type="hidden" name="videoId" value={v.id} />
              <Button type="submit">Publish</Button>
            </form>

            <form action="/api/admin/videos/hide" method="post">
              <input type="hidden" name="videoId" value={v.id} />
              <Button type="submit" variant="outline">Hide</Button>
            </form>

            <form action="/api/admin/videos/delete" method="post">
              <input type="hidden" name="videoId" value={v.id} />
              <Button type="submit" variant="destructive">Delete</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>
            Sửa title/category/tags/description. Việc lưu sẽ <b>invalidate</b> Redis cache của “video tương tự” cho video này.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/videos/update-metadata" method="post" className="space-y-4">
            <input type="hidden" name="videoId" value={v.id} />

            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={v.title} required />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={v.description} />
            </div>

            <div className="flex items-center gap-3">
              <Checkbox id="isSensitive" name="isSensitive" defaultChecked={Boolean((v as any).isSensitive)} />
              <Label htmlFor="isSensitive" className="cursor-pointer">
                Nội dung nhạy cảm (sensitive) — viewer có thể chọn hiển thị / làm mờ / ẩn.
              </Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select id="categoryId" name="categoryId" defaultValue={v.categoryId ?? ""}>
                <option value="">(None)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Textarea
                id="tags"
                name="tags"
                defaultValue={tagsStr}
                placeholder="tag1, tag2, tag3 (comma hoặc xuống dòng)"
              />
              <div className="text-xs text-zinc-500">Tối đa 20 tags. Hệ thống sẽ tự slugify.</div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="submit">Save metadata</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password gate</CardTitle>
          <CardDescription>
            Nếu set mật khẩu, trang watch `/v/[id]` sẽ trả <b>401 Unauthorized</b> cho viewer chưa unlock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={`/api/videos/${v.id}/password`} method="post" className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="pw_hint">Hint (optional)</Label>
              <Input id="pw_hint" name="hint" defaultValue={(v as any).accessPasswordHint ?? ""} placeholder="Gợi ý cho người xem" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pw">Password (để trống để clear)</Label>
              <Input id="pw" name="password" type="password" placeholder="Nhập mật khẩu" />
              <div className="text-xs text-zinc-500">
                Không hiển thị mật khẩu hiện tại. Nhập password mới để đổi; để trống để xoá password.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subtitles</CardTitle>
          <CardDescription>Danh sách subtitle + request subtitle mới.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {v.subtitles.length === 0 ? (
            <div className="text-sm text-zinc-500">None</div>
          ) : (
            <ul className="space-y-2">
              {v.subtitles.map((s) => (
                <li key={s.id} className="text-sm">
                  <span className="font-semibold">{s.lang}</span> —{" "}
                  <a href={resolveMediaUrl(s.vttKey) ?? "#"} className="hover:underline break-all">
                    {s.vttKey}
                  </a>{" "}
                  <span className="text-xs text-zinc-500">({s.provider})</span>
                </li>
              ))}
            </ul>
          )}

          <form action="/api/admin/subtitles/request" method="post" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="videoId" value={v.id} />
            <div className="grid gap-2">
              <Label htmlFor="lang">Lang</Label>
              <Input id="lang" name="lang" placeholder="vi/en" defaultValue="vi" className="w-[120px]" />
            </div>
            <Button type="submit" variant="secondary">Request subtitle</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
