"use client";

import { Tracker } from "@/lib/tracker";
import { MenuSelect } from "./Menu";
import { REPEAT_LABEL, REPEAT_OPTIONS, repeatOf, type RoutineFields, type RoutineKind } from "@/lib/routines";

/** How often a goal, book or workout comes round in Recurring on Today. */
export function RepeatSelect({
  tracker,
  kind,
  item,
  inline,
}: {
  tracker: Tracker;
  kind: RoutineKind;
  item: RoutineFields & { id: string };
  /** Among small figures, sized as the text around it. */
  inline?: boolean;
}) {
  return (
    <MenuSelect
      label="Repeat"
      className={inline ? "menu-select--inline" : ""}
      value={repeatOf(kind, item)}
      onChange={(v) => void tracker.setRepeat(kind, item.id, v)}
      options={REPEAT_OPTIONS.map((r) => ({ value: r, label: REPEAT_LABEL[r] }))}
    />
  );
}
