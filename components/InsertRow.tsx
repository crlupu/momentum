"use client";

import { Plus } from "./icons";

/**
 * An add at the end of a list: a plain row where the next item will go, a
 * grey + tile where the items have theirs and what it adds in words, as the
 * live workout's Add new set. Every in-list add in the app is this, in
 * sentence case.
 */
export function InsertRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button type="button" className="insert-row" onClick={onPress}>
      <span className="icon-disc insert-row__plus" aria-hidden>
        <Plus />
      </span>
      <span className="insert-row__label">{label}</span>
    </button>
  );
}
