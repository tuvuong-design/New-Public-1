import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function tmpdir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return dir;
}

export function rmrf(p: string) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
}
