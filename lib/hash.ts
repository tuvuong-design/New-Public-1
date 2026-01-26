import { createHash } from "crypto";

export function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}
