"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Check, ChevronRight, Dumbbell, School, TaskDone, Target, Video, X } from "../icons";
import type { PlanIcon } from "@/lib/plan";

/**
 * The parts every v2 screen is built from (Hallmark, app scope): a lead per
 * screen, list panels of rows, a figure strip, disclosure rows; four button
 * kinds; one field; loading, empty and failed states. Surfaces never nest.
 */

/** Runs an async action once at a time, so a control can hold itself disabled. */
export function usePending() {
  const [pending, setPending] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setPending(true);
    try {
      return await fn();
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, run };
}

const GLYPH: Record<PlanIcon, typeof BookOpen> = { book: BookOpen, gym: Dumbbell, video: Video, learn: School, task: TaskDone, target: Target };

/** A kind's icon in the grey tile rows lead with. */
export function Tile({ icon, children }: { icon?: PlanIcon; children?: ReactNode }) {
  const G = icon ? GLYPH[icon] ?? TaskDone : null;
  return (
    <span className="v2-tile" aria-hidden>
      {G ? <G /> : children}
    </span>
  );
}

type BtnKind = "primary" | "secondary" | "quiet" | "icon";
export function Button({
  kind = "secondary",
  small,
  working,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; small?: boolean; working?: boolean }) {
  const cls = ["v2-btn", kind !== "secondary" && `v2-btn--${kind}`, small && "v2-btn--small", working && "is-working", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} aria-busy={working || undefined} {...rest}>
      {children}
    </button>
  );
}

/** The done control: a ring, filled with ink once ticked. */
export function CheckButton({ on, label, disabled, onToggle }: { on: boolean; label: string; disabled?: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} className="v2-check" disabled={disabled} onClick={onToggle}>
      <span>{on && <Check aria-hidden />}</span>
    </button>
  );
}

/** Figures set in type under a title: a value and what it counts, no box. */
export function Strip({ items }: { items: { value: ReactNode; label: string }[] }) {
  return (
    <div className="v2-strip">
      {items.map((x) => (
        <div key={x.label}>
          <b>{x.value}</b>
          <span>{x.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A section's label: sentence case, muted, with one optional action at its end. */
export function Label({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="v2-label">
      <h2 style={{ font: "inherit", letterSpacing: 0, color: "inherit", margin: 0 }}>{children}</h2>
      {action}
    </div>
  );
}

/** A row: tile, a title with its detail beneath, one trailing control. */
export function Row({
  tile,
  title,
  sub,
  trail,
  done,
  onOpen,
}: {
  tile?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trail?: ReactNode;
  done?: boolean;
  onOpen?: () => void;
}) {
  const text = (
    <span className="v2-row__text">
      <span className="v2-row__title">{title}</span>
      {sub != null && <span className="v2-row__sub">{sub}</span>}
    </span>
  );
  return (
    <li className={"v2-row" + (tile ? "" : " v2-row--plain") + (done ? " is-done" : "")}>
      {onOpen ? (
        <button type="button" className="v2-row__open" onClick={onOpen}>
          {tile}
          {text}
        </button>
      ) : (
        <>
          {tile}
          {text}
        </>
      )}
      <span className="v2-trail">{trail}</span>
    </li>
  );
}

/** One row that opens in place: Left from earlier, done items, history. */
export function Disclosure({ title, sub, count, children, defaultOpen = false }: { title: ReactNode; sub?: ReactNode; count?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" className="v2-disc" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="v2-row__text">
          <span className="v2-row__title">{title}</span>
          {sub != null && <span className="v2-row__sub">{sub}</span>}
        </span>
        <span className="v2-disc__count">
          {count}
          <ChevronRight aria-hidden />
        </span>
      </button>
      {open && children}
    </div>
  );
}

/** What belongs in an empty list, and the one action that fills it. */
export function Empty({ title, line, action }: { title: string; line?: string; action?: ReactNode }) {
  return (
    <div className="v2-empty">
      <b>{title}</b>
      {line && <span>{line}</span>}
      {action}
    </div>
  );
}

/** A bottom sheet on a phone, a centred dialog from 48rem. Esc and the scrim close it. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      html.style.overflow = was;
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="v2 v2-scrim" style={{ minHeight: 0, background: undefined }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="v2-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <span className="v2-sheet__grab" aria-hidden />
        <div className="v2-sheet__head">
          <h2>{title}</h2>
          <Button kind="icon" aria-label="Close" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
