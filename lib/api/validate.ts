import { ZodSchema } from "zod";
import type { NextRequest } from "next/server";

export async function parseJson<T>(req: NextRequest, schema: ZodSchema<T>) {
  const raw = await req.json().catch(() => null);
  return schema.safeParse(raw);
}
