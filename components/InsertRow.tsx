"use client";

import { Plus } from "./icons";

/**
 * An add at the end of a list: a ringed row waiting where the next item will
 * go, what it adds in words and a blue + on the right, as the live workout's
 * Add new set. Every in-list add in the app is this, in sentence case.
 */
export function InsertRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button type="button" className="insert-row" onClick={onPress}>
      <span className="insert-row__label">{label}</span>
      <span className="icon-disc insert-row__plus" aria-hidden>
        <Plus />
      </span>
    </button>
  );
}
