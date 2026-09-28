"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "./icons";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** For dialogs that hold a whole view rather than a short form. */
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  useEffect(() => setMounted(true), []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Rendered into <body>: cards use backdrop-filter, which makes them the
  // containing block for fixed positioning, so a modal nested inside one would
  // otherwise be centred on that card rather than on the page.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="scrim absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className={"dialog overlay-surface " + (wide ? "md:max-w-2xl" : "md:max-w-md")}
        style={{ color: "var(--overlay-foreground)" }}
      >
        <div className="sheet__grabber md:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="icon-circle">
            <X aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
