"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const current = theme === "system" ? systemTheme : theme;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme(current === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        {current === "dark" ? "Light" : "Dark"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setTheme("system")}>
        Auto
      </Button>
    </div>
  );
}
