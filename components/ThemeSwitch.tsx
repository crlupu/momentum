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

/**
 * The app's styles. Signal Volt is the default: all black, and only the next
 * step lights up in the logo's blue. Signal Blue paints the hero cards in the
 * logo's gradient; Neutral is the quiet grey original.
 */
export const DEFAULT_STYLE = "volt";
const STYLES = [
  { value: "volt", label: "Signal Volt", note: "Black; only what's next lights up", swatch: ["#000000", "#1a1a1e", "#2b91ff"] },
  { value: "neutral", label: "Neutral", note: "Greys, one blue accent", swatch: ["#0b0b0c", "#1f1f22", "#024cff"] },
  { value: "signal", label: "Signal Blue", note: "Black, the logo's blue, heavy titles", swatch: ["#000000", "#2b91ff", "#0667db"] },
] as const;
export const STYLE_KEY = "momentum:style";

/**
 * The style, stored per device and set on <html data-style>. The inline
 * script in the layout applies it before the first paint, so the page never
 * flashes in the other style.
 */
export function StyleSwitch() {
  const [style, setStyle] = useState<string | null>(null);
  useEffect(() => {
    setStyle(document.documentElement.dataset.style || DEFAULT_STYLE);
  }, []);
  const choose = (v: string) => {
    setStyle(v);
    document.documentElement.dataset.style = v;
    try {
      localStorage.setItem(STYLE_KEY, v);
    } catch {}
  };
  return (
    <div role="radiogroup" aria-label="Style" className="style-cards style-cards--3">
      {STYLES.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={style === o.value}
          onClick={() => choose(o.value)}
          className="style-card"
        >
          <span className="style-card__swatch" aria-hidden>
            {o.swatch.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </span>
          <span className="style-card__name">{o.label}</span>
          <span className="style-card__note">{o.note}</span>
        </button>
      ))}
    </div>
  );
}
