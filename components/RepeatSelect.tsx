"use client";

import { Tracker } from "@/lib/tracker";
import { REPEAT_LABEL, REPEAT_OPTIONS, repeatOf, type RoutineFields, type RoutineKind } from "@/lib/routines";

/** How often a goal, book or workout comes round in Recurring on Today. */
export function RepeatSelect({
  tracker,
  kind,
  item,
  className = "row-select",
}: {
  tracker: Tracker;
  kind: RoutineKind;
  item: RoutineFields & { id: string };
  className?: string;
}) {
  return (
    <select
      aria-label="Repeat"
      className={className}
      value={repeatOf(kind, item)}
      onChange={(e) => void tracker.setRepeat(kind, item.id, e.target.value as (typeof REPEAT_OPTIONS)[number])}
    >
      {REPEAT_OPTIONS.map((r) => (
        <option key={r} value={r}>
          {REPEAT_LABEL[r]}
        </option>
      ))}
    </select>
  );
}
