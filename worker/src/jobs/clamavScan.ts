import { flags } from "../env";
import { execCmd } from "../utils/exec";

export async function clamavScan(filePath: string) {
  if (!flags.clamav) return { ok: true, skipped: true };

  // Prefer clamdscan if available (daemon). Fallback to clamscan.
  const tryCmds: [string, string[]][] = [
    ["clamdscan", ["--no-summary", filePath]],
    ["clamscan", ["--no-summary", filePath]],
  ];

  for (const [cmd, args] of tryCmds) {
    const res = await execCmd(cmd, args);
    if (res.code === 0) return { ok: true, engine: cmd };
    if (res.code === 127) continue;
    // clamdscan returns 1 for infected
    if (res.code === 1) return { ok: false, infected: true, engine: cmd, detail: res.stdout + res.stderr };
  }

  return { ok: true, skipped: true, note: "clamdscan/clamscan not available" };
}
