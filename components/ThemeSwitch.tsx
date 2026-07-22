"use client";

import { Switch } from "@heroui/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeSwitch() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch: reserve space until mounted.
  if (!mounted) return <div className="h-6 w-[52px]" aria-hidden />;

  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex items-center gap-2">
      <Sun className="h-4 w-4 text-foreground/60" aria-hidden />
      <Switch
        aria-label="Toggle dark mode"
        isSelected={isDark}
        onChange={(selected: boolean) => setTheme(selected ? "dark" : "light")}
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
      <Moon className="h-4 w-4 text-foreground/60" aria-hidden />
    </div>
  );
}
