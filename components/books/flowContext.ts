"use client";

import { createContext, useContext } from "react";

/**
 * Every dialog the reading views can open. Only the top of the stack is
 * shown; closing one returns to the one beneath, so a dialog opened from a
 * book's page goes back to that page when it is done.
 */
export type Dialog =
  | { kind: "detail"; bookId: string }
  | { kind: "edit"; bookId: string | null; trackId?: string }
  | { kind: "log"; bookId: string }
  | { kind: "deps"; bookId: string }
  | { kind: "wip"; bookId: string }
  | { kind: "finish"; bookId: string }
  | { kind: "next"; bookId: string; finishedTitle: string }
  | { kind: "bulk"; trackId?: string }
  | { kind: "import" }
  | { kind: "track"; trackId: string | null }
  | { kind: "phase"; phaseId: string | null };

export type Flow = {
  /** Opens a dialog over whatever is showing. */
  open: (d: Dialog) => void;
  /** Swaps the showing dialog for another, for one step leading to the next. */
  replace: (d: Dialog) => void;
  /** Closes the showing dialog. */
  close: () => void;
  /** Opens a book, checking what it should be read after and the track's limit. */
  start: (bookId: string) => void;
  /** Opens a book despite what it should be read after; still minds the limit. */
  startAnyway: (bookId: string) => void;
  /** Finishes a book, then offers the next one in its track. */
  finish: (bookId: string) => Promise<void>;
  /**
   * Called after progress moved: if it reached the last page, asks whether
   * the book is finished.
   */
  checkEnd: (bookId: string) => void;
};

export const FlowContext = createContext<Flow | null>(null);

export function useFlow(): Flow {
  const f = useContext(FlowContext);
  if (!f) throw new Error("useFlow is only available inside ReadingFlow");
  return f;
}
