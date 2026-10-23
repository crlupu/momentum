"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "./icons";

/**
 * A pop-up menu in the app's own style, as iOS draws one: a rounded, blurred
 * panel by what opened it, a check by the current choice. Native <select>
 * menus are drawn by the system, and on Windows that is a white list with
 * blue text whatever the app's theme.
 *
 * Laid over the page (fixed, in a portal), so a scrolling sheet can't clip
 * it; it opens below its button, or above when there's no room below.
 */
function Popover({
  anchor,
  onClose,
  children,
  label,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const p = panel.current!.getBoundingClientRect();
    const gap = 6;
    const below = a.bottom + gap + p.height <= window.innerHeight - 8;
    const top = below ? a.bottom + gap : Math.max(8, a.top - gap - p.height);
    // Right edges line up, as for a value at the end of a row.
    const left = Math.min(Math.max(8, a.right - p.width), window.innerWidth - p.width - 8);
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchor.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = [...(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    const away = () => onClose();
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", away);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    // The current choice, or the first item, takes the focus.
    const el =
      panel.current?.querySelector<HTMLButtonElement>("[aria-checked='true']") ??
      panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    el?.focus({ preventScroll: true });
  }, [pos]);

  return createPortal(
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      className="menu-panel"
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
    >
      {children}
    </div>,
    document.body
  );
}

export type MenuOption<T extends string> = { value: T; label: string; color?: string };

/**
 * A choice in a row: the current value and a chevron, opening a menu of the
 * options with a check by the chosen one.
 */
export function MenuSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
}: {
  value: T;
  options: MenuOption<T>[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={"menu-select " + className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? "none"}`}
        onClick={() => setOpen((v) => !v)}
      >
        {current?.color && <span className="cat-dot" style={{ background: current.color }} aria-hidden />}
        <span className="truncate">{current?.label ?? "None"}</span>
        <svg viewBox="0 0 12 16" width="9" height="12" aria-hidden className="menu-select__chev">
          <path d="M2.5 6 6 2.5 9.5 6M2.5 10 6 13.5 9.5 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && btn.current && (
        <Popover anchor={btn.current} onClose={() => setOpen(false)} label={label}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              className="menu-item"
              onClick={() => {
                setOpen(false);
                if (o.value !== value) onChange(o.value);
                btn.current?.focus();
              }}
            >
              <span className="menu-item__check">{o.value === value && <Check aria-hidden />}</span>
              <span className="menu-item__label">{o.label}</span>
              {o.color && <span className="cat-dot" style={{ background: o.color }} aria-hidden />}
            </button>
          ))}
        </Popover>
      )}
    </>
  );
}

export type MenuAction =
  | { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; checked?: boolean }
  | { heading: string }
  | "separator";

/** A button that opens a menu of actions: ⋯ on a row or a section. */
export function ActionMenu({
  label,
  items,
  children,
  className = "",
}: {
  label: string;
  items: MenuAction[];
  children: ReactNode;
  className?: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {children}
      </button>
      {open && btn.current && (
        <Popover anchor={btn.current} onClose={() => setOpen(false)} label={label}>
          {items.map((it, i) =>
            it === "separator" ? (
              <div key={i} className="menu-sep" role="separator" />
            ) : "heading" in it ? (
              <div key={i} className="menu-heading">
                {it.heading}
              </div>
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                className={"menu-item" + (it.danger ? " menu-item--danger" : "")}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
              >
                <span className="menu-item__check">{it.checked && <Check aria-hidden />}</span>
                <span className="menu-item__label">{it.label}</span>
              </button>
            )
          )}
        </Popover>
      )}
    </>
  );
}
