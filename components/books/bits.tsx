"use client";

import { ReactNode } from "react";
import type { Book } from "@/lib/tracker";
import { bookColor, bookProgress } from "@/lib/tracker";
import { STATUS_LABEL, type BookStatus, type ReadingTrack } from "@/lib/reading";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "28 Sep", or "28 Sep 2026" when the year matters. */
export function fmtDate(key: string | undefined | null, withYear = false): string {
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** Year shown only when it isn't this one. */
export function fmtDateAuto(key: string | undefined | null): string {
  if (!key) return "—";
  return fmtDate(key, key.slice(0, 4) !== String(new Date().getFullYear()));
}

export function monthLabel(key: string): string {
  const [, m] = key.split("-").map(Number);
  return MONTHS[m - 1];
}

/** Whole pages, or a tenth when the number is small enough for it to matter. */
export function fmtPace(perDay: number): string {
  if (perDay <= 0) return "0";
  return perDay >= 10 ? String(Math.round(perDay)) : perDay.toFixed(1).replace(/\.0$/, "");
}

export function TrackDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{ width: size, height: size, background: color }}
    />
  );
}

export function TrackChip({ track }: { track?: ReadingTrack }) {
  if (!track) return null;
  return (
    <span className="cat-chip" style={{ ["--chip-color" as string]: track.color }}>
      <span className="cat-chip__dot" aria-hidden />
      {track.name}
    </span>
  );
}

export function StatusBadge({ status }: { status: BookStatus }) {
  return <span className={`rd-status rd-status--${status}`}>{STATUS_LABEL[status]}</span>;
}

/** The thin bar under a book, in its own colour. */
export function Meter({ book, colour }: { book: Book; colour?: string }) {
  // Floored, not rounded: 299 of 300 pages rounds up to 100%, which read as
  // finished with a page still to go.
  const pct = book.status === "finished" ? 100 : Math.floor(bookProgress(book) * 100);
  return (
    <div className="book-card__meter" aria-hidden>
      <span style={{ width: `${pct}%`, background: colour ?? bookColor(book) }} />
    </div>
  );
}

/** "143 / 320 · 44%", or "143 pages read" when the length isn't known. */
export function ProgressText({ book }: { book: Book }) {
  if (book.pages > 0) {
    const pct = book.status === "finished" ? 100 : Math.floor(bookProgress(book) * 100);
    return (
      <span className="text-xs text-foreground/60">
        <span className="font-mono-n font-bold text-foreground">{book.read}</span> / {book.pages} ·{" "}
        {pct}%
      </span>
    );
  }
  return (
    <span className="text-xs text-foreground/60">
      <span className="font-mono-n font-bold text-foreground">{book.read}</span> pages read
    </span>
  );
}

/** A row of mutually exclusive buttons: tabs, modes, filters. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={"seg" + (size === "sm" ? " seg--sm" : "")} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg__btn"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small caps heading used inside the reading views. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={
        "text-[13px] font-semibold uppercase tracking-wide text-foreground/50 " + (className ?? "")
      }
    >
      {children}
    </h3>
  );
}

/** A labelled field for the forms. */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-foreground/60">{label}</span>
      {children}
      {hint && <span className="text-xs text-foreground/45">{hint}</span>}
    </label>
  );
}
