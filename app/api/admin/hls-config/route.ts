import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const segmentSeconds = Math.max(2, Math.min(30, Number(form.get("segmentSeconds") ?? 15)));
  const packaging = String(form.get("packaging") ?? "SINGLE_FILE");
  const ladderJson = String(form.get("ladderJson") ?? "[]");

  // Strict allowlist to avoid accidental unsupported ffmpeg modes.
  const ALLOWED = new Set(["SINGLE_FILE", "FMP4", "HYBRID_TS_ABR_FMP4_SOURCE"]);
  if (!ALLOWED.has(packaging)) {
    return new Response("packaging invalid", { status: 400 });
  }

  // Validate JSON
  try { JSON.parse(ladderJson); } catch { return new Response("ladderJson invalid", { status: 400 }); }

  await prisma.hlsConfig.upsert({
    where: { id: 1 },
    update: { segmentSeconds, packaging, ladderJson },
    create: { id: 1, segmentSeconds, packaging, ladderJson },
  });

  redirect("/admin/hls");
}
