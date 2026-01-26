import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { canAccessInstallWizard } from "@/lib/install/guard";

export const runtime = "nodejs";

const schema = z.object({
  envContent: z.string().min(1),
  overwrite: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  if (!canAccessInstallWizard()) return new Response("Not found", { status: 404 });

  const body = schema.parse(await req.json());
  const target = path.join(process.cwd(), ".env");

  try {
    await fs.writeFile(target, body.envContent, { encoding: "utf-8", flag: body.overwrite ? "w" : "wx" });
    return Response.json({ ok: true, message: "Wrote .env successfully" });
  } catch (e: any) {
    if (e?.code === "EEXIST") {
      return Response.json({ ok: false, message: ".env already exists (refused to overwrite)" }, { status: 400 });
    }
    if (e?.code === "EACCES" || e?.code === "EPERM") {
      return Response.json({ ok: false, message: "No permission to write .env (copy-paste content into aaPanel instead)" }, { status: 400 });
    }
    return Response.json({ ok: false, message: e?.message || "Write .env failed" }, { status: 400 });
  }
}
