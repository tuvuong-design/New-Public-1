import { NextResponse } from "next/server";

export function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}
