"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Auto, Sun, Moon } from "./icons";

const OPTIONS = [
  { value: "system", label: "System", icon: Auto },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/**
 * Appearance: follow the system, or pin light or dark.
 *
 * System is the default, so the app changes with the device's own setting
 * the way every other app does. The two pinned choices are kept for anyone
 * who wants Momentum to differ from the rest of their screen.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch: the stored choice is only known on the client.
  const current = mounted ? (theme ?? "system") : null;

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={["segmented", className].filter(Boolean).join(" ")}
    >
      {OPTIONS.map((o) => {
        const on = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(o.value)}
            className={"segmented__item" + (on ? " is-on" : "")}
          >
            <o.icon aria-hidden className="h-4 w-4" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
