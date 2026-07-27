"use client";

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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 mt-16 w-full max-w-md rounded-2xl border border-foreground/10 p-5 sm:mt-0"
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
          <button onClick={onClose} aria-label="Close" className="text-foreground/50 hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
