"use client";

import { ReactNode } from "react";

/**
 * A bare glyph button, as iOS puts actions on a row: no fill, no border, the
 * glyph in the tint colour in a full-size tap area. Every row action (edit,
 * duplicate, move, complete, and the ⊖ delete) is this size, so a group of
 * them reads as one set.
 */
export function IconButton({
  label,
  onPress,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

/** iOS's completion mark: an empty ring, or a filled tint disc with a check. */
export function CheckRing({ on }: { on: boolean }) {
  return on ? (
    <svg viewBox="0 0 22 22" width="22" height="22" aria-hidden>
      <circle cx="11" cy="11" r="10" fill="var(--accent)" />
      <path d="M6.5 11.3 9.6 14.3 15.5 8" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 22 22" width="22" height="22" aria-hidden>
      <circle cx="11" cy="11" r="9.6" fill="none" stroke="var(--muted)" strokeWidth="1.6" />
    </svg>
  );
}
