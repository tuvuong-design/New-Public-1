import * as React from "react";
import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default"|"outline"|"ghost"|"luxury" };

export function Button({ className, variant="default", ...props }: Props) {
  const v =
    variant === "luxury"
      ? "bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-950 hover:from-amber-200 hover:to-amber-400"
      : variant === "outline"
      ? "border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
      : variant === "ghost"
      ? "hover:bg-zinc-100 dark:hover:bg-zinc-800"
      : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

  return (
    <button
      className={cn("h-10 px-4 rounded-full text-sm font-medium transition-colors", v, className)}
      {...props}
    />
  );
}
