import * as React from "react";
import { cn } from "@/lib/utils";

const Separator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cn("my-3 h-px w-full bg-zinc-200", className)}
      {...props}
    />
  )
);
Separator.displayName = "Separator";

export { Separator };
