"use client";

import { Panel } from "./Panel";
import { Card } from "./ui";
import { usePending } from "./ActionButton";
import { Check } from "./icons";
import { Tracker, dateKey } from "@/lib/tracker";
import { REPEAT_LABEL, routines, type Routine } from "@/lib/routines";

function RoutineCheckbox({ tracker, r }: { tracker: Tracker; r: Routine }) {
  const { pending, run } = usePending();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={r.done}
      aria-label={r.title}
      // Done by activity: a session logged, pages read, the workout finished.
      // Only that takes it back, so the box holds.
      disabled={pending || r.auto}
      title={r.auto ? "Done: logged this period" : undefined}
      onClick={() => void run(() => tracker.toggleRoutine(r.kind, r.id))}
      className={"check" + (r.done ? " check--on" : "")}
    >
      <span className="check__ring">{r.done && <Check className="h-4 w-4" aria-hidden />}</span>
    </button>
  );
}

const KIND_ORDER = { goal: 0, book: 1, workout: 2 } as const;
const FREQ_ORDER = { daily: 0, weekly: 1, monthly: 2 } as const;

/**
 * The recurring list, kept by itself: active goals, books being read and
 * workouts, each ticked as soon as there's activity on it in its period.
 * How often each comes round is set on the goal, book or workout.
 */
export default function RecurringList({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const list = routines(s, dateKey()).sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      FREQ_ORDER[a.freq] - FREQ_ORDER[b.freq] ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );

  return (
    <Panel title="Recurring" bare>
      <Card>
        <Card.Content className="px-3 py-3 md:px-4">
          {list.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-[var(--muted)]">
              Nothing recurring. Active goals, books being read and workouts show here.
            </p>
          ) : (
            <ul
              className={
                "list-none p-0 " + (list.length > 5 ? "max-h-[17rem] overflow-y-auto pr-1 recurring-scroll" : "")
              }
            >
              {list.map((r) => (
                <li key={r.key} className="task-row">
                  <RoutineCheckbox tracker={tracker} r={r} />
                  <span className={"task-row__title " + (r.done ? "is-done" : "")}>
                    {r.title}
                    <span className="task-row__group">{REPEAT_LABEL[r.freq]}</span>
                  </span>
                  <span className="task-row__cat">
                    <span className="cat-dot" style={{ background: r.cat.color }} aria-hidden />
                    <span className="truncate">{r.cat.name}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>
    </Panel>
  );
}
