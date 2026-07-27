"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-foreground/10 p-5"
        style={{
          background: "var(--overlay)",
          color: "var(--overlay-foreground)",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-foreground/50 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
