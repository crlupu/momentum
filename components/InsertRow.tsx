"use client";

import { Plus } from "./icons";

/**
 * An add at the end of a list, as iOS edit lists add (Contacts, Settings):
 * a full-width row of the list itself, the blue ⊕ disc and what it adds in
 * words. Every in-list add in the app is this; adds for a whole section
 * (New Goal, New Path) are tinted buttons in its header instead.
 */
export function InsertRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button type="button" className="insert-row" onClick={onPress}>
      <span className="icon-disc">
        <Plus />
      </span>
      {label}
    </button>
  );
}
