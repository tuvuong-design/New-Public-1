import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({
  value,
  max = 100,
  className,
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeVal = Number.isFinite(value) ? value : 0;
  const pct = Math.max(0, Math.min(100, (safeVal / safeMax) * 100));

  return (
    <div className={cn("h-2 w-full rounded-full bg-neutral-200", className)}>
      <div className="h-2 rounded-full bg-neutral-900" style={{ width: `${pct}%` }} />
    </div>
  );
}
