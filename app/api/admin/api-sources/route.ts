import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session)) return new Response("FORBIDDEN", { status: 403 });

  const form = await req.formData();
  const mode = String(form.get("mode") ?? "create");

  const name = String(form.get("name") ?? "").slice(0, 120);
  const prefix = String(form.get("prefix") ?? "").slice(0, 50);
  const baseUrl = String(form.get("baseUrl") ?? "").slice(0, 500);
  const apiKey = String(form.get("apiKey") ?? "").slice(0, 500) || null;
  const enabled = form.get("enabled") === "on";
  const mappingJson = String(form.get("mappingJson") ?? "{}");

  try { JSON.parse(mappingJson); } catch { return new Response("mappingJson invalid", { status: 400 }); }

  if (!name || !prefix || !baseUrl) return new Response("missing fields", { status: 400 });

  if (mode === "update") {
    const id = String(form.get("id") ?? "");
    if (!id) return new Response("id required", { status: 400 });
    await prisma.apiSource.update({ where: { id }, data: { name, prefix, baseUrl, apiKey, enabled, mappingJson } });
  } else {
    await prisma.apiSource.create({ data: { name, prefix, baseUrl, apiKey, enabled, mappingJson } });
  }

  redirect("/admin/api-sources");
}
